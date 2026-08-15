"""One-shot, end-of-reading reasoning journey summary."""

import json
import logging
from typing import Any

import httpx

from ai_service import AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_TIMEOUT_SECONDS
from content import EVIDENCE, SOLUTION_STEPS
from schemas import (
    JourneyShift,
    LateArrivingClue,
    ReasoningJourneyRequest,
    ReasoningJourneyResponse,
    ReasoningMapNode,
)


logger = logging.getLogger("inkecho.reasoning_journey")
ALLOWED_EVIDENCE_IDS = {"E01", "E02", "E03"}


SYSTEM_PROMPT = """你是 UNPROVEN 的终局推理复盘编辑。你的任务不是打分，而是根据用户已经留下的推理记录，写出克制、具体、有证据依据的个人复盘。

严格规则：
1. 只总结输入中的 V1、压力问题、用户对压力问题的回应、V2、最终推理、批注，以及服务端提供的 E01—E03 和 Solution Steps。
2. shift 必须拆成 kept / changed / added：分别写用户保留的判断、真正改变的解释、后来新增的机制。即使没有明显变化，也要如实说明“未改变”或“未新增”，不能编造。
3. late_arriving_clue 只能根据 V1、V2、Final 与批注的文本先后关系判断。clue 写具体线索；arrived_at 只能是 V2、FINAL、ANNOTATION_ONLY、NOT_USED；basis 必须明确指出它在哪份用户记录中首次出现，或始终未被使用。不要声称用户“差点错过”。
4. final_reconstruction 用一段话复述用户最终如何连接机制，不把标准答案冒充成用户自己的发现。
5. reasoning_map 必须返回 4 个“用户认知变化”节点，不是案件机制的因果链。节点严格按 V1 → CP2 → V2 → FINAL 排列；CP2 节点优先依据用户自己的 stress_answer，不能只根据 V1/V2 猜测其回应。
6. 语气像结案档案，不夸奖，不给分，不使用空泛人格标签。
7. 只返回合法 JSON，字段必须且只能是 shift、final_reconstruction、late_arriving_clue、reasoning_map。solution_path 由服务端提供，不要生成。"""


def _compact_annotations(request: ReasoningJourneyRequest) -> list[dict[str, str]]:
    return [
        {"quote": item.quote.strip(), "note": item.note.strip()}
        for item in request.annotations
        if item.quote.strip() or item.note.strip()
    ][:20]


def build_journey_prompt(request: ReasoningJourneyRequest) -> str:
    evidence = [
        {"id": evidence_id, "fact": EVIDENCE[evidence_id].text}
        for evidence_id in ("E01", "E02", "E03")
    ]
    solution = [step.model_dump() for step in SOLUTION_STEPS]
    payload = {
        "hypothesis_v1": request.hypothesis_v1.model_dump(),
        "stress_result": request.stress_result.model_dump() if request.stress_result else None,
        "stress_answer": request.stress_answer.strip(),
        "hypothesis_v2": request.hypothesis_v2.model_dump() if request.hypothesis_v2 else None,
        "final_reasoning": request.final_reasoning.strip(),
        "annotations": _compact_annotations(request),
        "evidence": evidence,
        "solution_steps": solution,
    }
    return "请生成一次终局个人推理复盘：\n" + json.dumps(payload, ensure_ascii=False)


def build_journey_model_payload(request: ReasoningJourneyRequest) -> dict[str, Any]:
    return {
        "model": AI_MODEL,
        "temperature": 0.2,
        "enable_thinking": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_journey_prompt(request)},
        ],
        "response_format": {"type": "json_object"},
    }


def _fallback(request: ReasoningJourneyRequest) -> ReasoningJourneyResponse:
    v2 = request.hypothesis_v2 or request.hypothesis_v1
    assumption = (
        request.stress_result.selected_assumption
        if request.stress_result and request.stress_result.selected_assumption
        else "最初解释中有一步仍缺少文本直接证明"
    )
    annotated = next(
        (item.quote.strip() for item in request.annotations if item.quote.strip()),
        "",
    )
    v1_text = request.hypothesis_v1.text.strip()
    v2_text = v2.text.strip()
    final_text = request.final_reasoning.strip()
    stress_answer = request.stress_answer.strip()
    if not annotated:
        annotated = "现有记录不足以确定一条更晚进入推理的具体线索"
        clue_stage = "NOT_USED"
        clue_basis = "你没有留下可供核对的批注；因此不虚构一条只存在于批注中的线索。"
    elif annotated in v2_text and annotated not in v1_text:
        clue_stage = "V2"
        clue_basis = "这条线索没有出现在 V1，却在 V2 中首次出现。"
    elif annotated in final_text and annotated not in v1_text and annotated not in v2_text:
        clue_stage = "FINAL"
        clue_basis = "这条线索没有出现在 V1 或 V2，却在最终推理中首次出现。"
    elif annotated not in v1_text and annotated not in v2_text and annotated not in final_text:
        clue_stage = "ANNOTATION_ONLY"
        clue_basis = "这条线索只出现在你的批注中，没有写入 V1、V2 或最终推理。"
    else:
        annotated = "E01—E03 中仍未被你的版本变化明确引用的线索"
        clue_stage = "NOT_USED"
        clue_basis = "现有记录不能证明某条具体线索是后期才加入；因此不虚构一个“差点错过”的节点。"
    changed = v2.text.strip() != request.hypothesis_v1.text.strip()
    return ReasoningJourneyResponse(
        shift=JourneyShift(
            kept=(f"你仍保留了对原始机制的追问：{request.hypothesis_v1.text.strip()}" if changed else f"你保留了 V1 的核心判断：{v2.text.strip()}")[:180],
            changed=(f"你不再停留在“{request.hypothesis_v1.text.strip()}”，而把解释修正为“{v2.text.strip()}”。" if changed else "压力测试后，你没有改变原有判断。")[:180],
            added=(f"最终推理新增了完整连接：{request.final_reasoning.strip()}" if request.final_reasoning.strip() != v2.text.strip() else "最终推理没有再加入新的机制。")[:180],
        ),
        final_reconstruction=request.final_reasoning.strip()[:360],
        late_arriving_clue=LateArrivingClue(
            clue=annotated[:180],
            arrived_at=clue_stage,
            basis=clue_basis,
            evidence_ids=[],
        ),
        reasoning_map=[
            ReasoningMapNode(stage="V1", label="最初判断", detail=request.hypothesis_v1.text.strip()[:100], evidence_ids=[]),
            ReasoningMapNode(
                stage="CP2",
                label="回应质疑",
                detail=(stress_answer or f"压力测试要求重新检查：{assumption}")[:100],
                evidence_ids=(request.stress_result.rationale_evidence_ids if request.stress_result else []),
            ),
            ReasoningMapNode(stage="V2", label="审查决定", detail=v2.text.strip()[:100], evidence_ids=[]),
            ReasoningMapNode(stage="FINAL", label="最终连接", detail=request.final_reasoning.strip()[:100], evidence_ids=[]),
        ],
        solution_path=SOLUTION_STEPS,
        source="fallback",
    )


def _parse(raw: dict[str, Any]) -> ReasoningJourneyResponse:
    expected = {"shift", "final_reconstruction", "late_arriving_clue", "reasoning_map"}
    if set(raw) != expected:
        raise ValueError("journey output fields do not match schema")
    result = ReasoningJourneyResponse(**raw, solution_path=SOLUTION_STEPS, source="model")
    for node in result.reasoning_map:
        if not set(node.evidence_ids).issubset(ALLOWED_EVIDENCE_IDS):
            raise ValueError("journey evidence id is outside the whitelist")
    if [node.stage for node in result.reasoning_map] != ["V1", "CP2", "V2", "FINAL"]:
        raise ValueError("journey stages are not the required cognition sequence")
    if not set(result.late_arriving_clue.evidence_ids).issubset(ALLOWED_EVIDENCE_IDS):
        raise ValueError("late clue evidence id is outside the whitelist")
    return result


def summarize_reasoning_journey(request: ReasoningJourneyRequest) -> ReasoningJourneyResponse:
    if not AI_API_KEY:
        return _fallback(request)
    try:
        with httpx.Client(timeout=AI_TIMEOUT_SECONDS) as client:
            response = client.post(
                f"{AI_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"},
                json=build_journey_model_payload(request),
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        raw = json.loads(content)
        if not isinstance(raw, dict):
            raise TypeError("journey output must be a JSON object")
        return _parse(raw)
    except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("reasoning journey fallback: %s", exc)
        return _fallback(request)
