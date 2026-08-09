"""Pressure Test Agent。

职责：

Hypothesis
+
Evidence
+
Annotation
+
Checkpoint

↓

生成一个受控的 Pressure Test Question。

注意：

Evidence = 事实

Annotation = 用户认知线索，不是事实

Hypothesis = 用户观点，不是事实
"""

import json
import logging
import os
import re

from datetime import (
    datetime,
    timezone,
)

from typing import (
    Dict,
    List,
)

import httpx

from pydantic import (
    ValidationError,
)

from content import (
    SPOILER_TERMS,
    STRESS_CATEGORIES,
    STRESS_TEMPLATES,
)

from context_builder import (
    AgentContext,
    build_agent_context,
)

from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
)


logger = logging.getLogger(
    "inkecho.ai_service"
)


AI_API_KEY = os.environ.get(
    "OPENAI_API_KEY",
    "",
).strip()


AI_BASE_URL = os.environ.get(
    "AI_BASE_URL",
    "https://api.openai.com/v1",
).rstrip("/")


AI_MODEL = os.environ.get(
    "AI_MODEL",
    "gpt-4o-mini",
)


AI_TIMEOUT_SECONDS = float(
    os.environ.get(
        "AI_TIMEOUT_SECONDS",
        "10",
    )
)


MAX_QUESTION_CHARS = 80

MAX_ANNOTATIONS_IN_PROMPT = 30


# =========================
# AI Status
# =========================


_AI_STATUS: dict[
    str,
    object,
] = {
    "api_key_configured": (
        bool(AI_API_KEY)
    ),

    "base_url": (
        AI_BASE_URL
    ),

    "model": (
        AI_MODEL
    ),

    "mode": (
        "model"
        if AI_API_KEY
        else "fallback"
    ),

    "last_call_at": None,

    "last_success": None,

    "last_error": None,

    "last_fallback": (
        not bool(AI_API_KEY)
    ),
}


def _now_iso() -> str:

    return datetime.now(
        timezone.utc
    ).isoformat()


def get_ai_status() -> dict[
    str,
    object,
]:

    return dict(
        _AI_STATUS
    )


def _record_ai_status(
    *,
    success: bool | None,
    fallback: bool,
    error: str | None = None,
) -> None:

    _AI_STATUS.update(
        {
            "api_key_configured":
                bool(AI_API_KEY),

            "base_url":
                AI_BASE_URL,

            "model":
                AI_MODEL,

            "mode":
                (
                    "model"
                    if AI_API_KEY
                    else "fallback"
                ),

            "last_call_at":
                _now_iso(),

            "last_success":
                success,

            "last_error":
                error,

            "last_fallback":
                fallback,
        }
    )


# =========================
# System Prompt
# =========================


_SYSTEM_PROMPT = """
你是推理阅读产品 Inkecho 中的 Pressure Test Agent。

你的目标不是解出故事，
也不是告诉用户正确答案。

你的唯一任务是：

根据用户当前的 Hypothesis、
已经解锁的 Evidence、
以及用户自己的 Annotation，

找到用户当前解释中最值得检验的一个前提，
然后生成一个中性的压力问题。


你会收到三种信息。


【1. Evidence】

Evidence 是已经解锁的故事事实。

只有 Evidence 可以被当作事实使用。


【2. Annotation】

Annotation 是用户阅读过程中：

- 圈出的文字
- 划线
- 批注
- 猜测
- 关注点

Annotation 只能帮助你理解：

“这个用户正在注意什么？”

“这个用户可能倾向于怎样理解？”

Annotation 绝对不是事实。

即使用户在 Annotation 中猜中了正确答案，
也不能把这个猜测升级成事实。


【3. Hypothesis】

Hypothesis 是用户当前对故事的解释。

Hypothesis 同样不是事实。

Hypothesis 是你需要进行 Pressure Test 的对象。


严格遵守以下规则：


1.

只能使用提供给你的：

ALL UNLOCKED EVIDENCE

不得使用任何尚未解锁的故事信息。


2.

优先关注：

NEW EVIDENCE SINCE LAST CHECKPOINT

判断这些新 Evidence 是否让原 Hypothesis：

- 得到支持
- 被削弱
- 出现矛盾
- 暴露新的解释缺口


3.

Annotation 只能帮助理解用户认知状态。

绝不能说：

“根据你的批注可以确定……”

因为批注不是 Evidence。


4.

将用户 Hypothesis 整理成 1—5 个步骤：

normalized_steps

只能复述用户自己的意思。

不得替用户补充正确答案。


5.

找出 1—3 个：

unsupported_assumptions

也就是：

用户当前方案所依赖，
但已经解锁的 Evidence
尚未充分支持的前提。


6.

从这些前提中选择一个：

selected_assumption


7.

生成一个不超过 80 个汉字的：

question

这是最终直接展示给用户的问题。

必须遵守：

- 只问一个问题
- 优先围绕 NEW EVIDENCE SINCE LAST CHECKPOINT
- 针对当前 Hypothesis 中最关键、但尚未被证据支持的一步
- selected_assumption 必须尽量保持用户原本的说法，不得自行加入新的条件、属性或机制
- 如果用户说“A 可能通过 B 实现 C”，应优先追问“B 如何连接 A 和 C”，而不是自行假设 B 必须具有某个未被提及的物理属性
- 问题必须能够由“当前已经读到的内容”继续思考
- 用自然的阅读对话语气
- 不直接说用户错了
- 不提供正确答案
- 不透露后续剧情
- 不替故事补充不存在的事实
- 不得自行加入“足够大”“足够坚固”“足够长”“能够承重”“能够容纳”等物理属性，除非 Evidence 明确提供了相关信息
- 如果缺少尺寸、距离、强度等信息，不要要求用户仅凭不存在的数据判断物理可行性
- 不把“原文没有提到某事”自动理解为“这件事没有发生”
- 不制造新的反证，例如“为什么没有痕迹”“为什么没人发现”，除非 Evidence 明确说没有
- 不在问题中出现 E01、E02、E07 等 Evidence ID
- 不使用“根据 E07”“证据 E08 表明”这种内部系统语言
- 不连续提出多个问题

例如：

用户说：

“教授可能通过排水管和外面的人取得联系。”

当前已知：

- 老鼠通过某个圆孔消失
- 圆孔连接一根废弃排水管
- 教授正在尝试把信息传到牢房外

好的问题：

“你认为这根排水管在‘联系外界’这一步里具体起什么作用？目前哪条线索支持这个连接？”

也可以：

“你把排水管和联系外界联系在了一起，目前读到的哪些信息让你这样判断？”

不好的问题：

“这个排水管足够大吗？”

“不好的原因：
用户没有提出‘大小’这一前提，
Evidence 也没有提供足以判断尺寸是否合适的信息。”

例如：

如果用户说：

“教授可能通过排水管逃出去。”

而当前已经知道：

排水管很细，只发现它可以让老鼠通过。

好的问题：

“目前只知道老鼠能通过这根管道，你觉得教授本人也能从这里通过吗？”

不好的问题：

“为什么排水管里没有留下教授爬行的痕迹？”

因为后一个问题凭空假设了
“没有留下痕迹”这一事实。

好的问题应该让用户意识到：

“我的解释里有哪一步还缺少连接？”

而不是让用户猜 Agent 自己新创造出来的信息。


8.

category 只能是：

external_help
hidden_tool
physical_path
deception
unknown


9.

rationale_evidence_ids

只能填写已经提供给你的 Evidence ID。


10.

rationale_annotation_ids

只能填写已经提供给你的 Annotation ID。

如果不需要使用批注，
返回空数组。


只返回 JSON。

不要 Markdown。

不要解释。


格式：

{
  "normalized_steps": [
    "步骤1",
    "步骤2"
  ],

  "unsupported_assumptions": [
    "前提1"
  ],

  "selected_assumption":
    "前提1",

  "question":
    "压力问题",

  "category":
    "unknown",

  "rationale_evidence_ids": [
    "E01"
  ],

  "rationale_annotation_ids": [
    "annotation_id"
  ]
}
""".strip()


# =========================
# Prompt Builder
# =========================


def _format_evidence(
    items,
) -> str:

    if not items:
        return "（无）"

    return "\n".join(
        (
            f"- [{item.evidence_id}] "
            f"{item.text}"
        )
        for item in items
    )


def _format_annotations(
    items,
) -> str:

    if not items:
        return "（无）"

    lines = []

    for item in items[
        -MAX_ANNOTATIONS_IN_PROMPT:
    ]:

        note = item.note.strip()

        if not note:
            note = (
                "（无文字笔记；"
                "用户只进行了圈划"
                "或手写标记）"
            )

        lines.append(
            "\n".join(
                [
                    (
                        f"- "
                        f"[{item.annotation_id}]"
                    ),

                    (
                        f"  stage: "
                        f"{item.stage_id}"
                    ),

                    (
                        f"  quote: "
                        f"{item.quote}"
                    ),

                    (
                        f"  note: "
                        f"{note}"
                    ),

                    (
                        f"  input_mode: "
                        f"{item.input_mode}"
                    ),
                ]
            )
        )

    return "\n".join(
        lines
    )


def _build_user_prompt(
    context: AgentContext,
) -> str:

    new_evidence_ids = {
        item.evidence_id
        for item in context.new_evidence
    }

    old_evidence = [
        item
        for item in context.allowed_evidence
        if item.evidence_id
        not in new_evidence_ids
    ]

    new_annotation_ids = {
        item.annotation_id
        for item in context.new_annotations
    }

    old_annotations = [
        item
        for item in context.annotations
        if item.annotation_id
        not in new_annotation_ids
    ]

    return f"""
[CURRENT CHECKPOINT]

{context.checkpoint_id}


[CURRENT HYPOTHESIS]

{context.hypothesis_text}


[CONFIDENCE]

{context.confidence}


[NEW EVIDENCE SINCE LAST CHECKPOINT]

{_format_evidence(context.new_evidence)}


[EARLIER EVIDENCE]

{_format_evidence(old_evidence)}


[NEW USER ANNOTATIONS]

{_format_annotations(context.new_annotations)}


[EARLIER USER ANNOTATIONS]

{_format_annotations(old_annotations)}


优先检查 NEW EVIDENCE 与 CURRENT HYPOTHESIS 的关系。

只基于以上信息完成一次 Pressure Test。
""".strip()



# =========================
# Model Call
# =========================


def _call_model(
    context: AgentContext,
) -> dict:

    payload = {
        "model":
            AI_MODEL,

        "messages": [
            {
                "role":
                    "system",

                "content":
                    _SYSTEM_PROMPT,
            },

            {
                "role":
                    "user",

                "content":
                    _build_user_prompt(
                        context
                    ),
            },
        ],

        "temperature":
            0.25,

        "response_format": {
            "type":
                "json_object",
        },
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

    content = (
        body[
            "choices"
        ][0][
            "message"
        ][
            "content"
        ]
    )

    parsed = json.loads(
        content
    )

    _record_ai_status(
        success=True,
        fallback=False,
    )

    return parsed


# =========================
# Output Safety
# =========================


def _contains_spoiler(
    *texts: str,
) -> bool:

    joined = " ".join(
        texts
    )

    return any(
        term in joined
        for term in SPOILER_TERMS
    )


def _validate_model_output(
    raw: dict,
    context: AgentContext,
) -> AnalyzeResponse:

    allowed_evidence_ids = {
        item.evidence_id
        for item
        in context.allowed_evidence
    }

    allowed_annotation_ids = {
        item.annotation_id
        for item
        in context.annotations
    }

    normalized_steps = (
        raw[
            "normalized_steps"
        ]
    )

    unsupported_assumptions = (
        raw[
            "unsupported_assumptions"
        ]
    )

    selected_assumption = (
        raw[
            "selected_assumption"
        ]
    )

    question = (
        raw[
            "question"
        ]
    )

    category = (
        raw[
            "category"
        ]
    )

    rationale_evidence_ids = (
        raw.get(
            "rationale_evidence_ids",
            [],
        )
    )

    rationale_annotation_ids = (
        raw.get(
            "rationale_annotation_ids",
            [],
        )
    )

    if not isinstance(
        normalized_steps,
        list,
    ):
        raise ValueError(
            "normalized_steps "
            "must be list"
        )

    if not (
        1
        <= len(normalized_steps)
        <= 5
    ):
        raise ValueError(
            "normalized_steps "
            "length error"
        )

    if not isinstance(
        unsupported_assumptions,
        list,
    ):
        raise ValueError(
            "unsupported_assumptions "
            "must be list"
        )

    if not (
        1
        <= len(
            unsupported_assumptions
        )
        <= 3
    ):
        raise ValueError(
            "unsupported_assumptions "
            "length error"
        )

    if (
        selected_assumption
        not in
        unsupported_assumptions
    ):
        raise ValueError(
            "selected_assumption "
            "must come from "
            "unsupported_assumptions"
        )

    if (
        category
        not in STRESS_CATEGORIES
    ):
        raise ValueError(
            "invalid category"
        )

    if not isinstance(
        question,
        str,
    ):
        raise ValueError(
            "question must be string"
        )

    if (
        len(question)
        > MAX_QUESTION_CHARS
    ):
        raise ValueError(
            "question too long"
        )

    if not set(
        rationale_evidence_ids
    ).issubset(
        allowed_evidence_ids
    ):
        raise ValueError(
            "illegal evidence id"
        )

    if not set(
        rationale_annotation_ids
    ).issubset(
        allowed_annotation_ids
    ):
        raise ValueError(
            "illegal annotation id"
        )

    # normalized_steps 是用户自己观点的复述，
    # 所以不做剧透词检查。
    #
    # 真正需要检查的是 Agent 新生成的：
    # question / assumptions。

    if _contains_spoiler(
        question,

        selected_assumption,

        " ".join(
            unsupported_assumptions
        ),
    ):
        raise ValueError(
            "spoiler detected"
        )

    return AnalyzeResponse(
        normalized_steps=(
            normalized_steps
        ),

        unsupported_assumptions=(
            unsupported_assumptions
        ),

        selected_assumption=(
            selected_assumption
        ),

        question=(
            question
        ),

        category=(
            category
        ),

        rationale_evidence_ids=(
            rationale_evidence_ids
        ),

        rationale_annotation_ids=(
            rationale_annotation_ids
        ),

        new_evidence_ids=[
            item.evidence_id
            for item
            in context.new_evidence
        ],

        fallback=False,
    )


# =========================
# Fallback
# =========================


def _normalize_steps_fallback(
    hypothesis_text: str,
) -> List[str]:

    fragments = [
        fragment.strip()

        for fragment in re.split(
            r"[。！？；\n]",
            hypothesis_text,
        )

        if fragment.strip()
    ]

    if fragments:
        return fragments[:5]

    text = (
        hypothesis_text.strip()
    )

    if text:
        return [text]

    return [
        "用户尚未提供可拆解的解释"
    ]


def _classify_fallback(
    hypothesis_text: str,
) -> str:
    """
    fallback 分类器。

    只在 LLM 不可用或模型输出校验失败时使用。

    不再采用“第一个关键词命中就立即分类”，
    而是统计每个类别的关键词命中数量，
    最后选择得分最高的类别。
    """

    text = (
        hypothesis_text
        .strip()
        .lower()
    )

    if not text:
        return "unknown"

    scores: Dict[
        str,
        int,
    ] = {}

    for category in STRESS_CATEGORIES:

        if category == "unknown":
            continue

        template = (
            STRESS_TEMPLATES.get(
                category,
                {},
            )
        )

        keywords = str(
            template.get(
                "keywords",
                "",
            )
        ).strip()

        if not keywords:
            continue

        try:

            matches = re.findall(
                keywords,
                text,
            )

        except re.error:

            logger.warning(
                "invalid fallback regex "
                "for category=%s",
                category,
            )

            continue

        if matches:
            scores[
                category
            ] = len(matches)

    if not scores:
        return "unknown"

    best_category = max(
        scores,
        key=scores.get,
    )

    logger.info(
        "fallback classified: "
        "category=%s "
        "scores=%s "
        "hypothesis=%r",
        best_category,
        scores,
        hypothesis_text[:120],
    )

    return best_category


def _select_fallback_evidence_ids(
    template: Dict[
        str,
        object,
    ],
    context: AgentContext,
) -> List[str]:

    allowed_ids = {
        item.evidence_id
        for item
        in context.allowed_evidence
    }

    new_ids = [
        item.evidence_id
        for item
        in context.new_evidence
    ]

    preferred = [
        evidence_id

        for evidence_id
        in template.get(
            "preferred_evidence_ids",
            [],
        )

        if evidence_id
        in allowed_ids
    ]

    # 优先选择新 Evidence

    preferred_new = [
        evidence_id
        for evidence_id
        in preferred
        if evidence_id in new_ids
    ]

    if preferred_new:
        return preferred_new[:2]

    if preferred:
        return preferred[:2]

    if new_ids:
        return new_ids[:2]

    return list(
        allowed_ids
    )[:1]


def _select_fallback_annotation_ids(
    context: AgentContext,
    category: str,
) -> List[str]:

    template = (
        STRESS_TEMPLATES[
            category
        ]
    )

    keywords = str(
        template.get(
            "keywords",
            "",
        )
    )

    if not keywords:
        return []

    candidates = (
        context.new_annotations
        +
        context.annotations
    )

    seen = set()

    matched = []

    for item in candidates:

        if (
            item.annotation_id
            in seen
        ):
            continue

        seen.add(
            item.annotation_id
        )

        text = (
            f"{item.quote} "
            f"{item.note}"
        )

        if re.search(
            keywords,
            text,
        ):
            matched.append(
                item.annotation_id
            )

    return matched[:2]


def _fallback_response(
    context: AgentContext,
) -> AnalyzeResponse:

    category = (
        _classify_fallback(
            context.hypothesis_text
        )
    )

    template = (
        STRESS_TEMPLATES[
            category
        ]
    )

    return AnalyzeResponse(
        normalized_steps=(
            _normalize_steps_fallback(
                context.hypothesis_text
            )
        ),

        unsupported_assumptions=[
            str(
                template[
                    "assumption"
                ]
            )
        ],

        selected_assumption=str(
            template[
                "assumption"
            ]
        ),

        question=str(
            template[
                "question"
            ]
        ),

        category=(
            category
        ),

        rationale_evidence_ids=(
            _select_fallback_evidence_ids(
                template,
                context,
            )
        ),

        rationale_annotation_ids=(
            _select_fallback_annotation_ids(
                context,
                category,
            )
        ),

        new_evidence_ids=[
            item.evidence_id
            for item
            in context.new_evidence
        ],

        fallback=True,
    )


# =========================
# Public Agent API
# =========================


def analyze_hypothesis(
    request: AnalyzeRequest,
) -> AnalyzeResponse:

    # 关键步骤：
    #
    # 先由确定性的 Context Builder
    # 决定“用户此刻知道什么”
    #
    # 再交给 LLM。
    #
    # 不让 LLM 自己决定它能看到什么。

    context = (
        build_agent_context(
            request
        )
    )

    if not AI_API_KEY:

        logger.info(
            "AI_API_KEY not "
            "configured, "
            "using fallback"
        )

        _record_ai_status(
            success=None,

            fallback=True,

            error=(
                "OPENAI_API_KEY "
                "is not configured"
            ),
        )

        return (
            _fallback_response(
                context
            )
        )

    try:

        raw = _call_model(
            context
        )

        return (
            _validate_model_output(
                raw,
                context,
            )
        )

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

        _record_ai_status(
            success=False,

            fallback=True,

            error=(
                type(exc).__name__
            ),
        )

        logger.warning(
            (
                "model call failed, "
                "falling back. "
                "reason=%s "
                "hypothesis_length=%d"
            ),

            type(exc).__name__,

            len(
                context.hypothesis_text
            ),
        )

        return (
            _fallback_response(
                context
            )
        )