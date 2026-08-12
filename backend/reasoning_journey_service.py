"""One-shot, end-of-reading reasoning journey summary."""

import json
import logging
from typing import Any

import httpx

from ai_service import AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_TIMEOUT_SECONDS
from content import EVIDENCE, SOLUTION_STEPS
from schemas import (
    ReasoningJourneyRequest,
    ReasoningJourneyResponse,
    ReasoningMapNode,
)


logger = logging.getLogger("inkecho.reasoning_journey")
ALLOWED_EVIDENCE_IDS = {"E01", "E02", "E03"}


SYSTEM_PROMPT = """你是 UNPROVEN 的终局推理复盘编辑。你的任务不是打分，而是根据用户已经留下的推理记录，写出克制、具体、有证据依据的个人复盘。

严格规则：
1. 只总结输入中的 V1、压力测试、V2、最终推理、批注，以及服务端提供的 E01—E03 和 Solution Steps。
2. biggest_shift 要说清用户从什么判断转向什么判断；若用户选择保留，也要如实写成“保留”。
3. almost_missed_clue 必须指出一条用户较晚使用、没有写入推理或曾误读的具体线索；不要虚构阅读行为。
4. final_reconstruction 用一段话复述用户最终如何连接机制，不把标准答案冒充成用户自己的发现。
5. reasoning_map 返回 3—5 个按因果顺序排列的节点，每个节点有简短 label、detail 和相关 evidence_ids。
6. 语气像结案档案，不夸奖，不给分，不使用空泛人格标签。
7. 只返回合法 JSON，字段必须且只能是 biggest_shift、final_reconstruction、almost_missed_clue、reasoning_map。"""


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
        "老鼠消失、钱币变化与外部维修人员进入监狱之间的联系",
    )
    changed = v2.text.strip() != request.hypothesis_v1.text.strip()
    shift = (
        f"压力测试指出“{assumption}”。你随后调整了原先的解释，并形成 V2。"
        if changed
        else f"压力测试指出“{assumption}”。你重新检查后仍保留了原判断。"
    )
    return ReasoningJourneyResponse(
        biggest_shift=shift[:240],
        final_reconstruction=request.final_reasoning.strip()[:360],
        almost_missed_clue=f"值得回看的线索是“{annotated[:80]}”。它需要与其他事实连接后，才会成为完整机制的一部分。",
        reasoning_map=[
            ReasoningMapNode(label="异常出现", detail="钱币与牢房内物品的变化提示存在未解释的交换。", evidence_ids=["E01"]),
            ReasoningMapNode(label="隐藏联系", detail="老鼠的消失让第二条通信或运输路径成为可能。", evidence_ids=["E02"]),
            ReasoningMapNode(label="外部入口", detail="停电使外部维修人员获得被监狱认可的进入条件。", evidence_ids=["E03"]),
            ReasoningMapNode(label="最终重构", detail=request.final_reasoning.strip()[:100], evidence_ids=[]),
        ],
        source="fallback",
    )


def _parse(raw: dict[str, Any]) -> ReasoningJourneyResponse:
    expected = {"biggest_shift", "final_reconstruction", "almost_missed_clue", "reasoning_map"}
    if set(raw) != expected:
        raise ValueError("journey output fields do not match schema")
    result = ReasoningJourneyResponse(**raw, source="model")
    for node in result.reasoning_map:
        if not set(node.evidence_ids).issubset(ALLOWED_EVIDENCE_IDS):
            raise ValueError("journey evidence id is outside the whitelist")
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
