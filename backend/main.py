from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="Inkecho API",
    version="1.0.0",
)


# 允许本地 React 前端访问后端
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EchoRequest(BaseModel):
    text: str


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


@app.post("/api/echo")
def create_echo(request: EchoRequest):
    cleaned_text = request.text.strip()

    if not cleaned_text:
        return {
            "reply": "后端没有收到有效文字。",
        }

    return {
        "reply": f"这是后端返回的回声：{cleaned_text}",
    }