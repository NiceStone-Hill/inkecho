"""UNPROVEN 的单次 Pressure Test Agent。

模型只接收 Hypothesis V1 与服务端固定装入的 E01—E03。
它不读取小说全文、Solution、Annotation，也不负责判断答案对错。
"""

import json
import logging
import os

from datetime import datetime, timezone
from typing import Any

import httpx

from content import EVIDENCE, SPOILER_TERMS
from schemas import (
    AgentEvidence,
    AnalyzeRequest,
    AnalyzeResponse,
    PressureTestInput,
)


logger = logging.getLogger("inkecho.ai_service")


AI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
AI_BASE_URL = os.environ.get(
    "AI_BASE_URL",
    "https://api.openai.com/v1",
).rstrip("/")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")
AI_TIMEOUT_SECONDS = float(os.environ.get("AI_TIMEOUT_SECONDS", "10"))


FALLBACK_QUESTION = (
    "你的方案里，哪一步是文本已经明确证明的，"
    "哪一步其实是你自己补上的？"
)

ALLOWED_CATEGORIES = {
    "SPACE_PATH",
    "HUMAN_PASSAGE",
    "TOOL_SOURCE",
    "COMMUNICATION",
    "INSIDER_HELP",
    "UNCLEAR",
}

ALLOWED_EVIDENCE_IDS = {"E01", "E02", "E03"}

JUDGMENTAL_TERMS = (
    "你错了",
    "其实",
    "正确答案是",
    "标准答案",
)

KNOWN_SPOILER_TERMS = tuple(
    dict.fromkeys(
        [
            *SPOILER_TERMS,
            "哈奇",
            "袜线",
            "布信",
            "老鼠送信",
            "排水管传递",
            "运输工具",
            "换上电工服",
        ]
    )
)


_AI_STATUS: dict[str, object] = {
    "api_key_configured": bool(AI_API_KEY),
    "base_url": AI_BASE_URL,
    "model": AI_MODEL,
    "mode": "model" if AI_API_KEY else "fallback",
    "last_call_at": None,
    "last_success": None,
    "last_error": None,
    "last_fallback": not bool(AI_API_KEY),
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_ai_status() -> dict[str, object]:
    return dict(_AI_STATUS)


def _record_ai_status(
    *,
    success: bool | None,
    fallback: bool,
    error: str | None = None,
) -> None:
    _AI_STATUS.update(
        {
            "api_key_configured": bool(AI_API_KEY),
            "base_url": AI_BASE_URL,
            "model": AI_MODEL,
            "mode": "model" if AI_API_KEY else "fallback",
            "last_call_at": _now_iso(),
            "last_success": success,
            "last_error": error,
            "last_fallback": fallback,
        }
    )


def fallback_response() -> AnalyzeResponse:
    return AnalyzeResponse(
        selected_assumption=None,
        category="UNCLEAR",
        pressure_question=FALLBACK_QUESTION,
        rationale_evidence_ids=[],
    )


def build_pressure_test_input(request: AnalyzeRequest) -> PressureTestInput:
    """由服务端装入固定 Evidence，客户端无权扩大白名单。"""

    return PressureTestInput(
        checkpoint_id="CP2",
        hypothesis_v1=request.hypothesis_v1,
        unlocked_evidence=[
            AgentEvidence(
                id=evidence_id,
                fact=EVIDENCE[evidence_id].text,
            )
            for evidence_id in ("E01", "E02", "E03")
        ],
    )


def build_agent_prompt(input_data: PressureTestInput) -> str:
    evidence_block = "\n".join(
        f"- {item.id}: {item.fact}"
        for item in input_data.unlocked_evidence
    )

    return f"""你是 UNPROVEN 的 AI Pressure Test Agent。

你不是解谜者、裁判、答案提示器或小说总结器。
你的唯一任务是：只对照提供的 Evidence，识别用户 Hypothesis V1 成立所依赖、但文本尚未证明的一个最关键前提，并提出一句中性、不剧透的压力问题。

严格规则：
1. Evidence-first：只能使用下方 Evidence，不得使用小说全文、谜底、常识补全或外部知识。
2. Hypothesis-specific：必须针对用户自己的 V1。
3. One-shot：只选择一个关键未证前提；不要寻找用户遗漏的正确答案。
4. Neutral：禁止使用“你错了”“其实”“正确答案是”等判断性语言。
5. Non-spoiler：不得引入 Evidence 未出现的人物、工具、机制、身份或解决方案。
6. pressure_question 只问一个问题，长度必须为 20—60 个中文字。
7. rationale_evidence_ids 只能取 E01、E02、E03，且必须与分析直接相关。
8. 若输入太短、混乱或无法可靠识别，必须返回下方固定 UNCLEAR 结果，不得硬猜。
9. 只返回合法 JSON，不要 Markdown，不要解释。

允许的 category：SPACE_PATH、HUMAN_PASSAGE、TOOL_SOURCE、COMMUNICATION、INSIDER_HELP、UNCLEAR。

固定 fallback：
{{"selected_assumption":null,"category":"UNCLEAR","pressure_question":"{FALLBACK_QUESTION}","rationale_evidence_ids":[]}}

checkpoint_id: {input_data.checkpoint_id}
confidence: {input_data.hypothesis_v1.confidence}
hypothesis_v1: {json.dumps(input_data.hypothesis_v1.text, ensure_ascii=False)}

当前唯一允许使用的 Evidence：
{evidence_block}"""


PRESSURE_TEST_JSON_SCHEMA = {
    "name": "pressure_test",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "selected_assumption",
            "category",
            "pressure_question",
            "rationale_evidence_ids",
        ],
        "properties": {
            "selected_assumption": {
                "type": ["string", "null"],
            },
            "category": {
                "type": "string",
                "enum": sorted(ALLOWED_CATEGORIES),
            },
            "pressure_question": {
                "type": "string",
            },
            "rationale_evidence_ids": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": sorted(ALLOWED_EVIDENCE_IDS),
                },
                "uniqueItems": True,
            },
        },
    },
}


def _call_model(input_data: PressureTestInput) -> dict[str, Any]:
    payload = {
        "model": AI_MODEL,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": build_agent_prompt(input_data),
            }
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": PRESSURE_TEST_JSON_SCHEMA,
        },
    }

    with httpx.Client(timeout=AI_TIMEOUT_SECONDS) as client:
        response = client.post(
            f"{AI_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {AI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        body = response.json()

    content = body["choices"][0]["message"]["content"]
    if not isinstance(content, str):
        raise TypeError("model content must be a JSON string")

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise TypeError("model output must be a JSON object")

    return parsed


def _introduces_spoiler(
    generated_text: str,
    input_data: PressureTestInput,
) -> bool:
    source_text = " ".join(
        [
            input_data.hypothesis_v1.text,
            *(item.fact for item in input_data.unlocked_evidence),
        ]
    )

    return any(
        term in generated_text and term not in source_text
        for term in KNOWN_SPOILER_TERMS
    )


def parse_model_output(
    raw: dict[str, Any],
    input_data: PressureTestInput,
) -> AnalyzeResponse:
    expected_keys = {
        "selected_assumption",
        "category",
        "pressure_question",
        "rationale_evidence_ids",
    }

    if set(raw) != expected_keys:
        raise ValueError("model output fields do not match schema")

    selected_assumption = raw["selected_assumption"]
    category = raw["category"]
    pressure_question = raw["pressure_question"]
    rationale_ids = raw["rationale_evidence_ids"]

    if category == "UNCLEAR":
        if (
            selected_assumption is not None
            or pressure_question != FALLBACK_QUESTION
            or rationale_ids != []
        ):
            raise ValueError("UNCLEAR must use the fixed fallback")
        return fallback_response()

    if category not in ALLOWED_CATEGORIES:
        raise ValueError("invalid category")

    if not isinstance(selected_assumption, str) or not selected_assumption.strip():
        raise ValueError("selected_assumption is required")

    if not isinstance(pressure_question, str):
        raise ValueError("pressure_question must be a string")

    pressure_question = pressure_question.strip()
    if not 20 <= len(pressure_question) <= 60:
        raise ValueError("pressure_question length is out of range")

    if sum(pressure_question.count(mark) for mark in ("?", "？")) != 1:
        raise ValueError("pressure_question must contain exactly one question")

    if not isinstance(rationale_ids, list):
        raise ValueError("rationale_evidence_ids must be a list")

    if len(rationale_ids) != len(set(rationale_ids)):
        raise ValueError("rationale_evidence_ids must be unique")

    if not set(rationale_ids).issubset(ALLOWED_EVIDENCE_IDS):
        raise ValueError("evidence id is outside the fixed whitelist")

    generated_text = f"{selected_assumption} {pressure_question}"
    if any(term in generated_text for term in JUDGMENTAL_TERMS):
        raise ValueError("judgmental language detected")

    if _introduces_spoiler(generated_text, input_data):
        raise ValueError("spoiler detected")

    return AnalyzeResponse(
        selected_assumption=selected_assumption.strip(),
        category=category,
        pressure_question=pressure_question,
        rationale_evidence_ids=rationale_ids,
    )


def analyze_hypothesis(request: AnalyzeRequest) -> AnalyzeResponse:
    input_data = build_pressure_test_input(request)
    compact_text = "".join(input_data.hypothesis_v1.text.split())

    if len(compact_text) < 8:
        _record_ai_status(success=None, fallback=True, error="hypothesis too short")
        return fallback_response()

    if not AI_API_KEY:
        _record_ai_status(success=None, fallback=True, error="OPENAI_API_KEY is not configured")
        return fallback_response()

    try:
        raw = _call_model(input_data)
        result = parse_model_output(raw, input_data)
    except (
        httpx.HTTPError,
        json.JSONDecodeError,
        KeyError,
        IndexError,
        TypeError,
        ValueError,
    ) as exc:
        logger.warning(
            "Pressure Test failed; using fixed fallback. reason=%s",
            type(exc).__name__,
        )
        _record_ai_status(success=False, fallback=True, error=type(exc).__name__)
        return fallback_response()

    _record_ai_status(
        success=True,
        fallback=result.category == "UNCLEAR",
    )
    return result
