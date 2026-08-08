"""前后端共享的请求/响应数据结构。"""

from typing import List, Literal

from pydantic import BaseModel, Field


Confidence = Literal["low", "medium", "high"]


class StatementCard(BaseModel):
    card_id: str
    text: str
    answer_type: str


class Evidence(BaseModel):
    evidence_id: str
    text: str
    source_stage: int


class Checkpoint(BaseModel):
    checkpoint_id: str
    kind: Literal["capture", "pressure", "final"]
    title: str
    prompt: str


class StageContent(BaseModel):
    stage_id: int
    title: str
    order: int
    segments: List[str]

    statement_cards: List[StatementCard] = Field(
        default_factory=list
    )

    allowed_evidence: List[Evidence]

    checkpoint: Checkpoint | None = None


class StageSummary(BaseModel):
    stage_id: int
    title: str
    order: int


class SolutionStep(BaseModel):
    step_id: int
    text: str
    evidence_ids: List[str]


class SolutionResponse(BaseModel):
    steps: List[SolutionStep]


# =========================
# Agent / Pressure Test
# =========================


class AnalyzeRequest(BaseModel):
    # 用于找到这个用户自己的批注
    session_id: str = Field(
        min_length=1,
        max_length=120,
    )

    stage_id: int

    # CP2 / CP3
    checkpoint_id: str = Field(
        min_length=1,
        max_length=40,
    )

    # 进入当前 checkpoint 时的上一版 Hypothesis
    # CP2 -> V1
    # CP3 -> V2
    hypothesis_text: str = Field(
        min_length=1,
        max_length=2000,
    )

    confidence: Confidence


class AnalyzeResponse(BaseModel):
    # 对用户假设的结构化复述
    normalized_steps: List[str]

    # 当前解释依赖、但 Evidence 尚未支持的前提
    unsupported_assumptions: List[str]

    # 本轮主要测试的前提
    selected_assumption: str

    # 真正显示给用户的问题
    question: str

    category: str

    # 本轮 Agent 用到了哪些 Evidence
    rationale_evidence_ids: List[str]

    # 本轮 Agent 参考了哪些用户批注
    rationale_annotation_ids: List[str] = Field(
        default_factory=list
    )

    # 从上一个 checkpoint 到当前 checkpoint
    # 新解锁了哪些 Evidence
    new_evidence_ids: List[str] = Field(
        default_factory=list
    )

    fallback: bool


# =========================
# Annotation
# =========================


class DrawingPoint(BaseModel):
    # 0 ~ 1 相对坐标
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class AnnotationCreate(BaseModel):
    session_id: str = Field(
        min_length=1,
        max_length=120,
    )

    stage_id: int

    segment_index: int = Field(
        ge=0,
    )

    quote: str = Field(
        min_length=1,
        max_length=200,
    )

    note: str = Field(
        default="",
        max_length=300,
    )

    # text = 键盘批注
    # draw = 手写 / 圈划
    input_mode: Literal[
        "text",
        "draw",
    ] = "text"

    strokes: List[
        List[DrawingPoint]
    ] = Field(
        default_factory=list
    )


class AnnotationResponse(BaseModel):
    id: str

    session_id: str

    stage_id: int

    segment_index: int

    quote: str

    note: str

    input_mode: Literal[
        "text",
        "draw",
    ] = "text"

    strokes: List[
        List[DrawingPoint]
    ] = Field(
        default_factory=list
    )

    created_at: str