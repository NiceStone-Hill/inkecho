"""构建 Pressure Test Agent 的认知上下文。

核心原则：

Evidence
= 已确认事实

Annotation
= 用户的关注、圈划、猜测
≠ 事实

Hypothesis
= 用户当前解释
≠ 事实

Agent 永远只能把 Evidence 当事实使用。
"""

from pydantic import BaseModel, Field

from content import (
    STAGES,
    STAGES_BY_ID,
)

from schemas import (
    AnalyzeRequest,
    Confidence,
    Evidence,
)

from state_store import (
    get_annotations_up_to_stage,
)


class AgentAnnotation(BaseModel):
    annotation_id: str

    stage_id: int

    segment_index: int

    quote: str

    note: str

    input_mode: str


class AgentContext(BaseModel):
    session_id: str

    stage_id: int

    checkpoint_id: str

    hypothesis_text: str

    confidence: Confidence

    # 到当前为止全部允许使用的事实
    allowed_evidence: list[
        Evidence
    ] = Field(
        default_factory=list
    )

    # 从上一个 checkpoint 之后
    # 新出现的事实
    new_evidence: list[
        Evidence
    ] = Field(
        default_factory=list
    )

    # 用户到目前为止的全部批注
    annotations: list[
        AgentAnnotation
    ] = Field(
        default_factory=list
    )

    # 上一个 checkpoint 之后
    # 新增加的批注
    new_annotations: list[
        AgentAnnotation
    ] = Field(
        default_factory=list
    )


def _find_previous_checkpoint_stage(
    current_stage_id: int,
) -> int:
    """寻找上一个 checkpoint 所在 stage。

    例如：

    CP2 在 stage 5
    上一个 checkpoint CP1 在 stage 4

    所以：
    previous_checkpoint_stage = 4
    """

    previous_stage_id = 0

    for stage in STAGES:

        if (
            stage.stage_id
            >= current_stage_id
        ):
            break

        if stage.checkpoint is not None:
            previous_stage_id = (
                stage.stage_id
            )

    return previous_stage_id


def build_agent_context(
    request: AnalyzeRequest,
) -> AgentContext:

    stage = STAGES_BY_ID.get(
        request.stage_id
    )

    if stage is None:
        raise ValueError(
            f"unknown stage_id: "
            f"{request.stage_id}"
        )

    if stage.checkpoint is None:
        raise ValueError(
            "current stage has no "
            "checkpoint"
        )

    if (
        stage.checkpoint.checkpoint_id
        != request.checkpoint_id
    ):
        raise ValueError(
            "checkpoint_id does not "
            "match current stage"
        )

    if (
        stage.checkpoint.kind
        != "pressure"
    ):
        raise ValueError(
            "analyze is only available "
            "for pressure checkpoints"
        )

    # -------------------------
    # 找上一个 checkpoint
    # -------------------------

    previous_checkpoint_stage = (
        _find_previous_checkpoint_stage(
            request.stage_id
        )
    )

    # -------------------------
    # Evidence
    # -------------------------

    allowed_evidence = list(
        stage.allowed_evidence
    )

    # 例如：
    #
    # CP2 stage 5
    # previous = stage 4
    #
    # 因此：
    # E07 / E08
    # 是本轮 new evidence

    new_evidence = [
        evidence
        for evidence in allowed_evidence
        if (
            previous_checkpoint_stage
            < evidence.source_stage
            <= request.stage_id
        )
    ]

    # -------------------------
    # Annotation
    # -------------------------

    raw_annotations = (
        get_annotations_up_to_stage(
            request.session_id,
            request.stage_id,
        )
    )

    annotations = [
        AgentAnnotation(
            annotation_id=item.id,
            stage_id=item.stage_id,
            segment_index=(
                item.segment_index
            ),
            quote=item.quote,
            note=item.note,
            input_mode=(
                item.input_mode
            ),
        )
        for item in raw_annotations
    ]

    new_annotations = [
        annotation
        for annotation in annotations
        if (
            previous_checkpoint_stage
            < annotation.stage_id
            <= request.stage_id
        )
    ]

    # -------------------------
    # 最终 Agent Context
    # -------------------------

    return AgentContext(
        session_id=(
            request.session_id
        ),

        stage_id=(
            request.stage_id
        ),

        checkpoint_id=(
            request.checkpoint_id
        ),

        hypothesis_text=(
            request.hypothesis_text
        ),

        confidence=(
            request.confidence
        ),

        allowed_evidence=(
            allowed_evidence
        ),

        new_evidence=(
            new_evidence
        ),

        annotations=(
            annotations
        ),

        new_annotations=(
            new_annotations
        ),
    )