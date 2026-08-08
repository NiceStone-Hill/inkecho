"""前后端共享的请求/响应数据结构（唯一字段来源）。"""

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


class StageContent(BaseModel):
    stage_id: int
    title: str
    order: int
    segments: List[str]

    statement_cards: List[
        StatementCard
    ] = Field(default_factory=list)

    allowed_evidence: List[Evidence]


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


class AnalyzeRequest(BaseModel):
    stage_id: int

    hypothesis_text: str = Field(
        min_length=1,
        max_length=2000,
    )

    confidence: Confidence


class AnalyzeResponse(BaseModel):
    normalized_steps: List[str]

    unsupported_assumptions: List[str]

    selected_assumption: str

    question: str

    category: str

    rationale_evidence_ids: List[str]

    fallback: bool


# -------------------------
# 批注相关
# -------------------------

class DrawingPoint(BaseModel):
    # 使用 0 ~ 1 的相对坐标，
    # 这样画布大小改变后也能保持笔迹比例。
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
    # draw = 手写批注
    input_mode: Literal[
        "text",
        "draw",
    ] = "text"

    strokes: List[
        List[DrawingPoint]
    ] = Field(default_factory=list)


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
    ] = Field(default_factory=list)

    created_at: str