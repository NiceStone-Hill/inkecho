"""AI 分析服务：假说结构化 + 默认前提探测 + 压力问题生成。

设计要点（对应 PRD 第7章与第6.3节）：
- 只在此处发起唯一一次模型调用；请求只携带当前阶段允许的证据文本。
- 模型输出必须是结构化 JSON；任何解析失败、字段缺失、越界证据引用、
  命中禁词或超时都会触发确定性降级兜底，绝不向用户暴露技术错误。
- 降级结果按关键词把假说归入五类之一，返回对应的人工安全问题，
  保证“模型不可用时仍保留因用户假说而不同”的最低个性化。
"""

import json
import logging
import os
import re
from typing import Dict, List

import httpx
from pydantic import ValidationError

from content import SPOILER_TERMS, STAGES_BY_ID, STRESS_CATEGORIES, STRESS_TEMPLATES
from schemas import AnalyzeRequest, AnalyzeResponse

logger = logging.getLogger("inkecho.ai_service")

AI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")
AI_TIMEOUT_SECONDS = float(os.environ.get("AI_TIMEOUT_SECONDS", "10"))

MAX_QUESTION_CHARS = 60

_SYSTEM_PROMPT = (
    "你是推理阅读产品中的“默认前提探测”组件，唯一职责是分析用户提交的越狱假说。\n"
    "严格规则：\n"
    "1. 只能使用下面提供的“当前允许证据”，不得引用或暗示证据之外的任何人物、工具、通道或机制。\n"
    "2. 将用户假说整理为2—5个步骤（normalized_steps），只能来自用户自己的表达，不得替用户补充新的正确步骤；"
    "假说本身包含的动作较少时，保持步骤数与实际动作数一致，不得为了凑数拆分或编造。\n"
    "3. 找出1—3条用户依赖但尚未被允许证据支持的默认前提（unsupported_assumptions）。\n"
    "4. 从中选出一条最关键的（selected_assumption），并生成一个不超过60字的中性追问（question），"
    "只测试该前提被抽走后方案是否仍成立，不判断对错、不给出答案、不引导向具体后续情节。\n"
    "5. 给question分类（category），取值只能是：external_help、hidden_tool、physical_path、deception、unknown。\n"
    "6. rationale_evidence_ids 必须是“当前允许证据”中出现的 evidence_id 子集。\n"
    "7. 只返回一个JSON对象，不要包含任何解释文字或Markdown代码块标记，字段必须严格如下例：\n"
    '{"normalized_steps": ["步骤1", "步骤2", "步骤3"], '
    '"unsupported_assumptions": ["前提1"], '
    '"selected_assumption": "前提1", '
    '"question": "不超过60字的追问", '
    '"category": "hidden_tool", '
    '"rationale_evidence_ids": ["E01"]}'
)

def _build_user_prompt(request: AnalyzeRequest, allowed_evidence_text: List[str]) -> str:
    evidence_block = "\n".join(f"- {line}" for line in allowed_evidence_text)
    return (
        f"当前允许证据：\n{evidence_block}\n\n"
        f"用户确信度：{request.confidence}\n"
        f"用户假说原文：{request.hypothesis_text}"
    )


def _call_model(request: AnalyzeRequest, allowed_evidence_text: List[str]) -> dict:
    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(request, allowed_evidence_text)},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=AI_TIMEOUT_SECONDS) as client:
        response = client.post(
            f"{AI_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        body = response.json()

    content = body["choices"][0]["message"]["content"]
    return json.loads(content)


def _contains_spoiler(*texts: str) -> bool:
    joined = " ".join(texts)
    return any(term in joined for term in SPOILER_TERMS)


def _validate_model_output(raw: dict, allowed_evidence_ids: List[str]) -> AnalyzeResponse:
    candidate = AnalyzeResponse(
        normalized_steps=raw["normalized_steps"],
        unsupported_assumptions=raw["unsupported_assumptions"],
        selected_assumption=raw["selected_assumption"],
        question=raw["question"],
        category=raw["category"],
        rationale_evidence_ids=raw["rationale_evidence_ids"],
        fallback=False,
    )

    if not (2 <= len(candidate.normalized_steps) <= 5):
        raise ValueError("normalized_steps length out of range")
    if not (1 <= len(candidate.unsupported_assumptions) <= 3):
        raise ValueError("unsupported_assumptions length out of range")
    if candidate.category not in STRESS_CATEGORIES:
        raise ValueError("invalid category")
    if len(candidate.question) > MAX_QUESTION_CHARS:
        raise ValueError("question too long")
    if not set(candidate.rationale_evidence_ids).issubset(set(allowed_evidence_ids)):
        raise ValueError("evidence_id out of allowed scope")
    # 只校验模型自己生成的内容（前提、追问），不校验 normalized_steps——
    # 它是用户自己原话的复述，用户提前用对了词不算 AI 剧透，不应被这里拦截。
    if _contains_spoiler(
        candidate.question,
        candidate.selected_assumption,
        " ".join(candidate.unsupported_assumptions),
    ):
        raise ValueError("spoiler term detected")

    return candidate


def _normalize_steps_fallback(hypothesis_text: str) -> List[str]:
    fragments = [
        fragment.strip()
        for fragment in re.split(r"[。！？；\n]", hypothesis_text)
        if fragment.strip()
    ]

    if len(fragments) >= 3:
        return fragments[:5]

    text = hypothesis_text.strip()
    if not text:
        return ["用户尚未提供可拆解的方案描述"] * 3

    chunk_count = 3
    chunk_size = max(1, len(text) // chunk_count)
    chunks = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]
    return chunks[:5] if len(chunks) >= 3 else (chunks + [text])[:3]


def _classify_fallback(hypothesis_text: str) -> str:
    for category in STRESS_CATEGORIES:
        keywords = STRESS_TEMPLATES[category]["keywords"]
        if keywords and re.search(keywords, hypothesis_text):
            return category
    return "unknown"


def _select_fallback_evidence_ids(
    template: Dict[str, object], allowed_evidence_ids: List[str]
) -> List[str]:
    allowed_set = set(allowed_evidence_ids)
    preferred = [
        evidence_id
        for evidence_id in template.get("preferred_evidence_ids", [])
        if evidence_id in allowed_set
    ]
    if preferred:
        return preferred[:2]
    return allowed_evidence_ids[:1]


def _fallback_response(request: AnalyzeRequest, allowed_evidence_ids: List[str]) -> AnalyzeResponse:
    category = _classify_fallback(request.hypothesis_text)
    template = STRESS_TEMPLATES[category]

    return AnalyzeResponse(
        normalized_steps=_normalize_steps_fallback(request.hypothesis_text),
        unsupported_assumptions=[template["assumption"]],
        selected_assumption=template["assumption"],
        question=template["question"],
        category=category,
        rationale_evidence_ids=_select_fallback_evidence_ids(template, allowed_evidence_ids),
        fallback=True,
    )


def analyze_hypothesis(request: AnalyzeRequest) -> AnalyzeResponse:
    stage = STAGES_BY_ID.get(request.stage_id)
    if stage is None:
        raise ValueError(f"unknown stage_id: {request.stage_id}")

    allowed_evidence_ids = [evidence.evidence_id for evidence in stage.allowed_evidence]
    allowed_evidence_text = [evidence.text for evidence in stage.allowed_evidence]

    if not AI_API_KEY:
        logger.info("AI_API_KEY not configured, using fallback classifier")
        return _fallback_response(request, allowed_evidence_ids)

    try:
        raw = _call_model(request, allowed_evidence_text)
        return _validate_model_output(raw, allowed_evidence_ids)
    except (
        httpx.TimeoutException,
        httpx.HTTPError,
        KeyError,
        IndexError,
        TypeError,
        ValueError,
        ValidationError,
        json.JSONDecodeError,
    ) as exc:
        logger.warning(
            "model call failed, falling back. reason=%s hypothesis_length=%d",
            type(exc).__name__,
            len(request.hypothesis_text),
        )
        return _fallback_response(request, allowed_evidence_ids)
