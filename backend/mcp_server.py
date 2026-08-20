"""Lightweight Streamable HTTP MCP tools for InkEcho.

The tools in this module are intentionally thin wrappers around the existing
FastAPI backend services. They do not call the local REST API over HTTP.
"""

import os

from typing import Literal
from uuid import uuid4

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.server import TransportSecuritySettings
from pydantic import ValidationError

from ai_service import analyze_hypothesis
from content import STAGES, STAGES_BY_ID
from qa_service import answer_question
from schemas import AnalyzeRequest, QARequest


def _allowed_hosts() -> list[str]:
    configured_hosts = [
        host.strip()
        for host in os.environ.get("MCP_ALLOWED_HOSTS", "").split(",")
        if host.strip()
    ]

    return [
        "127.0.0.1",
        "127.0.0.1:*",
        "localhost",
        "localhost:*",
        *configured_hosts,
    ]


mcp = FastMCP(
    "InkEcho Lightweight MCP",
    instructions=(
        "Expose InkEcho reading-stage context, spoiler-safe reading QA, and "
        "the pressure-test hypothesis analysis as Streamable HTTP MCP tools."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/mcp",
    transport_security=TransportSecuritySettings(
        allowed_hosts=_allowed_hosts(),
    ),
)


def _success(data: dict) -> dict:
    return {
        "ok": True,
        "data": data,
    }


def _error(message: str, *, trace_id: str | None = None) -> dict:
    return {
        "ok": False,
        "error": message,
        "trace_id": trace_id or uuid4().hex,
    }


@mcp.tool()
def list_reading_stages() -> dict:
    """List all InkEcho reading stages with their ids, titles, and order."""

    return _success(
        {
            "stages": [
                {
                    "stage_id": stage.stage_id,
                    "title": stage.title,
                    "order": stage.order,
                    "has_checkpoint": stage.checkpoint is not None,
                    "checkpoint_id": (
                        stage.checkpoint.checkpoint_id
                        if stage.checkpoint
                        else None
                    ),
                }
                for stage in STAGES
            ]
        }
    )


@mcp.tool()
def get_reading_stage(stage_id: int) -> dict:
    """Get one InkEcho reading stage, including visible text and unlocked evidence."""

    stage = STAGES_BY_ID.get(stage_id)

    if stage is None:
        return _error(f"unknown stage_id: {stage_id}")

    return _success(
        {
            "stage": stage.model_dump(mode="json"),
        }
    )


@mcp.tool()
def analyze_hypothesis_pressure(
    hypothesis_text: str,
    confidence: Literal["low", "medium", "high"] = "medium",
) -> dict:
    """Run InkEcho's CP2 pressure test against a reader hypothesis.

    The tool checks one user hypothesis against the server-controlled evidence
    whitelist. It returns a neutral pressure question, not the story solution.
    """

    cleaned_text = hypothesis_text.strip()

    if not cleaned_text:
        return _error("hypothesis_text is required")

    try:
        request = AnalyzeRequest(
            checkpoint_id="CP2",
            hypothesis_v1={
                "text": cleaned_text,
                "confidence": confidence,
            },
        )
        result = analyze_hypothesis(request)
    except ValidationError as exc:
        return _error(exc.errors()[0].get("msg", "invalid input"))
    except Exception as exc:  # pragma: no cover - defensive MCP boundary
        return _error(type(exc).__name__)

    return _success(
        {
            "analysis": result.model_dump(mode="json"),
        }
    )


@mcp.tool()
def ask_reading_context_question(
    session_id: str,
    question: str,
    stage_id: int | None = None,
) -> dict:
    """Ask InkEcho's spoiler-safe reading QA assistant a context question."""

    cleaned_session_id = session_id.strip()
    cleaned_question = question.strip()

    if not cleaned_session_id:
        return _error("session_id is required")

    if not cleaned_question:
        return _error("question is required")

    if stage_id is not None and stage_id not in STAGES_BY_ID:
        return _error(f"unknown stage_id: {stage_id}")

    try:
        request = QARequest(
            session_id=cleaned_session_id,
            stage_id=stage_id,
            question=cleaned_question,
        )
        result = answer_question(request)
    except ValidationError as exc:
        return _error(exc.errors()[0].get("msg", "invalid input"))
    except Exception as exc:  # pragma: no cover - defensive MCP boundary
        return _error(type(exc).__name__)

    return _success(
        {
            "answer": result.model_dump(mode="json"),
        }
    )
