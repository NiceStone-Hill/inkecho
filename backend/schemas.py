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
    kind: Literal["training", "capture", "pressure", "final"]
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


class HypothesisV1(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=300,
    )

    confidence: Confidence


class JourneyAnnotation(BaseModel):
    quote: str = Field(default="", max_length=600)
    note: str = Field(default="", max_length=300)


class JourneyStressResult(BaseModel):
    selected_assumption: str | None = Field(default=None, max_length=300)
    pressure_question: str = Field(default="", max_length=300)
    rationale_evidence_ids: List[str] = Field(default_factory=list)


class ReasoningJourneyRequest(BaseModel):
    hypothesis_v1: HypothesisV1
    stress_result: JourneyStressResult | None = None
    hypothesis_v2: HypothesisV1 | None = None
    final_reasoning: str = Field(min_length=1, max_length=1200)
    annotations: List[JourneyAnnotation] = Field(default_factory=list, max_length=40)


class ReasoningMapNode(BaseModel):
    label: str = Field(min_length=1, max_length=24)
    detail: str = Field(min_length=1, max_length=100)
    evidence_ids: List[Literal["E01", "E02", "E03"]] = Field(default_factory=list)


class ReasoningJourneyResponse(BaseModel):
    biggest_shift: str = Field(min_length=1, max_length=240)
    final_reconstruction: str = Field(min_length=1, max_length=360)
    almost_missed_clue: str = Field(min_length=1, max_length=240)
    reasoning_map: List[ReasoningMapNode] = Field(min_length=3, max_length=5)
    source: Literal["model", "fallback"] = "model"


# =========================
# Agent / Pressure Test
# =========================


class AnalyzeRequest(BaseModel):
    checkpoint_id: Literal["CP2"]

    hypothesis_v1: HypothesisV1


class AgentEvidence(BaseModel):
    id: Literal["E01", "E02", "E03"]

    fact: str = Field(
        min_length=1,
        max_length=2000,
    )


class PressureTestInput(BaseModel):
    checkpoint_id: Literal["CP2"]

    hypothesis_v1: HypothesisV1

    unlocked_evidence: List[AgentEvidence] = Field(
        min_length=3,
        max_length=3,
    )


class AnalyzeResponse(BaseModel):
    selected_assumption: str | None

    category: Literal[
        "SPACE_PATH",
        "HUMAN_PASSAGE",
        "TOOL_SOURCE",
        "COMMUNICATION",
        "INSIDER_HELP",
        "UNCLEAR",
    ]

    pressure_question: str

    rationale_evidence_ids: List[
        Literal["E01", "E02", "E03"]
    ]


# =========================
# General QA Agent
# =========================


class QARequest(BaseModel):
    session_id: str = Field(
        min_length=1,
        max_length=120,
    )

    # 用户当前所在的 stage，用于给出上下文
    # 到"思路历程"页时可以不传
    stage_id: int | None = None

    question: str = Field(
        min_length=1,
        max_length=200,
    )


class QAResponse(BaseModel):
    answer: str

    fallback: bool


# =========================
# Annotation
# =========================


class DrawingPoint(BaseModel):
    # 0 ~ 1 相对坐标
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class AnnotationSegmentSpan(BaseModel):
    """跨段批注中，单个段落内被选中的具体文字。

    用于精确高亮：不能靠在整段批注的 quote 里
    做 indexOf，因为跨段的 quote 是多段文字拼接的，
    没有分隔符，无法唯一还原到某一段。
    """

    segment_index: int = Field(ge=0)

    quote: str = Field(
        min_length=1,
        max_length=600,
    )


class AnnotationCreate(BaseModel):
    session_id: str = Field(
        min_length=1,
        max_length=120,
    )

    stage_id: int

    # 选区起始段落
    segment_index: int = Field(
        ge=0,
    )

    # 选区结束段落
    # 单段批注时两者相同
    segment_end_index: int = Field(
        ge=0,
    )

    # 完整批注文字（可跨段拼接）
    quote: str = Field(
        min_length=1,
        max_length=600,
    )

    # segment_index ~ segment_end_index
    # 之间，每一段各自被选中的文字
    spans: List[
        AnnotationSegmentSpan
    ] = Field(
        min_length=1,
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

    segment_end_index: int

    quote: str

    spans: List[
        AnnotationSegmentSpan
    ]

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
