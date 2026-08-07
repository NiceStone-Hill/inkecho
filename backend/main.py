import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from ai_service import analyze_hypothesis
from content import SOLUTION_STEPS, STAGES, STAGES_BY_ID
from schemas import (
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
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
