"""General QA Agent。

职责：

回答用户阅读过程中遇到的现实世界常识问题
（单位换算、词语释义、背景知识等）。

不参与推理，不讨论《思考机器》这篇故事的
逃脱方法或未读到的剧情。

这是一个和 Pressure Test Agent（ai_service.py）
完全独立的、轻量的百科问答 Agent：

Pressure Test Agent
= 只能用 Evidence 说话，专门用来测试用户假设

General QA Agent
= 只回答现实世界常识，帮助用户读懂文本
"""

import logging

from typing import (
    Optional,
)

import httpx

from ai_service import (
    AI_API_KEY,
    AI_BASE_URL,
    AI_MODEL,
    AI_TIMEOUT_SECONDS,
)

from content import (
    SPOILER_TERMS,
    STAGES_BY_ID,
)

from schemas import (
    QARequest,
    QAResponse,
)


logger = logging.getLogger(
    "inkecho.qa_service"
)


MAX_ANSWER_CHARS = 300


_UNAVAILABLE_ANSWER = (
    "我暂时连不上问答服务，"
    "你可以先查词典或搜索引擎，"
    "待会儿再问我一次。"
)


_SPOILER_ANSWER = (
    "这个问题我不方便在这里回答，"
    "要不要先继续往下读？"
)


_SYSTEM_PROMPT = """
你是阅读产品 Inkecho 里的百科问答助手。

用户正在阅读一篇推理故事
（爱德华·D·霍克式的思考机器探案故事）。

你的任务：

只负责解释用户读不懂的
现实世界常识，例如：

- 单位换算（英尺、英里换算成米/公里）
- 词语释义（例如“牙粉”是什么）
- 历史/生活背景知识

严格规则：

1. 不参与故事推理，
不猜测、不讨论教授可能如何逃脱。

2. 不透露、不暗示任何尚未读到的剧情
或最终解法。

3. 如果用户问的是故事情节、
逃脱方法、谜底之类的问题，
礼貌拒绝，并引导用户继续往下读，
不要给出任何实质性推测。

4. 回答控制在 150 字以内，
直接、简洁、口语化，
不使用 Markdown。

5. 如果提供了当前阅读进度上下文，
可以结合它理解用户的问题，
但不要主动剧透还没发生的内容。
""".strip()


def _build_user_prompt(
    request: QARequest,
) -> str:

    context_block = "（无）"

    if request.stage_id is not None:

        stage = STAGES_BY_ID.get(
            request.stage_id
        )

        if stage is not None:

            context_block = (
                f"标题：{stage.title}\n"
                +
                "\n".join(
                    stage.segments
                )
            )

    return (
        f"[用户当前读到的内容]\n\n"
        f"{context_block}\n\n"
        f"[用户的问题]\n\n"
        f"{request.question}\n\n"
        "请只回答用户的问题本身。"
    )


def _call_model(
    request: QARequest,
) -> str:

    payload = {
        "model": AI_MODEL,

        "messages": [
            {
                "role": "system",
                "content": _SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": (
                    _build_user_prompt(
                        request
                    )
                ),
            },
        ],

        "temperature": 0.2,
    }

    headers = {
        "Authorization":
            f"Bearer {AI_API_KEY}",

        "Content-Type":
            "application/json",
    }

    with httpx.Client(
        timeout=AI_TIMEOUT_SECONDS
    ) as client:

        response = client.post(
            (
                f"{AI_BASE_URL}"
                f"/chat/completions"
            ),

            headers=headers,

            json=payload,
        )

        response.raise_for_status()

        body = response.json()

    return (
        body["choices"][0]
        ["message"]["content"]
    ).strip()


def _contains_spoiler(
    text: str,
) -> bool:

    return any(
        term in text
        for term in SPOILER_TERMS
    )


def answer_question(
    request: QARequest,
) -> QAResponse:

    if not AI_API_KEY:

        logger.info(
            "AI_API_KEY not "
            "configured, "
            "using QA fallback"
        )

        return QAResponse(
            answer=(
                _UNAVAILABLE_ANSWER
            ),
            fallback=True,
        )

    try:

        answer = _call_model(
            request
        )

    except (
        httpx.TimeoutException,
        httpx.HTTPError,
        KeyError,
        IndexError,
        TypeError,
    ) as exc:

        logger.warning(
            (
                "QA model call failed, "
                "falling back. "
                "reason=%s"
            ),
            type(exc).__name__,
        )

        return QAResponse(
            answer=(
                _UNAVAILABLE_ANSWER
            ),
            fallback=True,
        )

    if not answer:

        return QAResponse(
            answer=(
                _UNAVAILABLE_ANSWER
            ),
            fallback=True,
        )

    if len(answer) > MAX_ANSWER_CHARS:
        answer = (
            answer[:MAX_ANSWER_CHARS]
        )

    if _contains_spoiler(answer):

        logger.warning(
            "QA answer contained "
            "spoiler term, "
            "falling back"
        )

        return QAResponse(
            answer=_SPOILER_ANSWER,
            fallback=True,
        )

    return QAResponse(
        answer=answer,
        fallback=False,
    )
