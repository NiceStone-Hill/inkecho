import logging
import os
from datetime import datetime, timezone
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from ai_service import analyze_hypothesis, get_ai_status
from content import SOLUTION_STEPS, STAGES, STAGES_BY_ID
from schemas import (
    AnnotationCreate,
    AnnotationResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    SolutionResponse,
    StageContent,
    StageSummary,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Inkecho API",
    version="1.0.0",
)


# 本地开发前端地址，始终允许；正式前端域名（如 GitHub Pages）通过
# ALLOWED_ORIGINS 环境变量追加，多个地址用逗号分隔。
# 对应产品需求文档 AC12：正式Origin可调用，其他Origin被拒绝。
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_EXTRA_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_ORIGINS + _EXTRA_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


_ANNOTATIONS: dict[str, list[AnnotationResponse]] = {}


@app.get("/")
def root():
    return {
        "name": "Inkecho API",
        "message": "The backend is running.",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
    }


@app.get("/api/ai/status")
def ai_status():
    return get_ai_status()


@app.get("/api/content/stages", response_model=list[StageSummary])
def list_stages():
    return [
        StageSummary(stage_id=stage.stage_id, title=stage.title, order=stage.order)
        for stage in STAGES
    ]


@app.get("/api/content/stages/{stage_id}", response_model=StageContent)
def get_stage(stage_id: int):
    stage = STAGES_BY_ID.get(stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="stage not found")
    return stage


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    cleaned_text = request.hypothesis_text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=422, detail="hypothesis_text is required")

    if request.stage_id not in STAGES_BY_ID:
        raise HTTPException(status_code=422, detail="unknown stage_id")

    normalized_request = request.model_copy(update={"hypothesis_text": cleaned_text})
    return analyze_hypothesis(normalized_request)


@app.get("/api/solution", response_model=SolutionResponse)
def get_solution():
    return SolutionResponse(steps=SOLUTION_STEPS)


@app.get("/api/annotations", response_model=list[AnnotationResponse])
def list_annotations(session_id: str):
    return sorted(
        _ANNOTATIONS.get(session_id, []),
        key=lambda item: (item.stage_id, item.segment_index, item.created_at),
    )


@app.post("/api/annotations", response_model=AnnotationResponse)
def create_annotation(request: AnnotationCreate):
    if request.stage_id not in STAGES_BY_ID:
        raise HTTPException(status_code=422, detail="unknown stage_id")

    stage = STAGES_BY_ID[request.stage_id]
    if request.segment_index >= len(stage.segments):
        raise HTTPException(status_code=422, detail="unknown segment_index")

    segment = stage.segments[request.segment_index]
    if request.quote not in segment:
        raise HTTPException(status_code=422, detail="quote does not belong to this segment")

    annotation = AnnotationResponse(
    id=uuid4().hex,
    session_id=request.session_id,
    stage_id=request.stage_id,
    segment_index=request.segment_index,
    quote=request.quote,
    note=request.note.strip(),
    input_mode=request.input_mode,
    strokes=request.strokes,
    created_at=datetime.now(timezone.utc).isoformat(),
)
    _ANNOTATIONS.setdefault(request.session_id, []).append(annotation)
    return annotation


@app.delete("/api/annotations/{annotation_id}")
def delete_annotation(annotation_id: str, session_id: str):
    annotations = _ANNOTATIONS.get(session_id, [])
    remaining = [item for item in annotations if item.id != annotation_id]
    if len(remaining) == len(annotations):
        raise HTTPException(status_code=404, detail="annotation not found")
    _ANNOTATIONS[session_id] = remaining
    return {"status": "deleted"}
