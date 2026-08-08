"""前后端共享的请求/响应数据结构（唯一字段来源）。

字段命名严格对应产品需求文档 7.2 与 5.2 中定义的字段，
前端调用接口时必须使用与此处完全一致的字段名。
"""

from typing import List, Literal

from pydantic import BaseModel, Field


Confidence = Literal["low", "medium", "high"]


class StatementCard(BaseModel):
    card_id: str
    text: str
    answer_type: str
    """标准答案分类：已确认事实 / 物理或制度约束 / 人物陈述 / 读者自己的默认前提。

    仅用于用户选择后的反馈说明，不在提交前展示给用户。
    """


class Evidence(BaseModel):
    evidence_id: str
    text: str
    source_stage: int


class StageContent(BaseModel):
    stage_id: int
    title: str
    order: int
    segments: List[str]
    statement_cards: List[StatementCard] = Field(default_factory=list)
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
    hypothesis_text: str = Field(min_length=1, max_length=2000)
    confidence: Confidence


class AnalyzeResponse(BaseModel):
    normalized_steps: List[str]
    unsupported_assumptions: List[str]
    selected_assumption: str
    question: str
    category: str
    rationale_evidence_ids: List[str]
    fallback: bool


class AnnotationCreate(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    stage_id: int
    segment_index: int = Field(ge=0)
    quote: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=300)


class AnnotationResponse(BaseModel):
    id: str
    session_id: str
    stage_id: int
    segment_index: int
    quote: str
    note: str
    created_at: str
