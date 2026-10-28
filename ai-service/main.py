
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

from graph import answer_question

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger("mahila_kaamsetu.api")

app = FastAPI(
    title="Mahila KaamSetu AI Service",
    version="1.1.0",
)

# Set FRONTEND_ORIGINS in the backend environment for deployment.
# Example: https://your-actual-website.vercel.app
origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class AssistantRequest(BaseModel):
    message: str = Field(min_length=2, max_length=3000)
    language: Literal["mr", "hi", "en"] = "mr"


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mahila-kaamsetu-ai",
        "graph": "langgraph",
    }


@app.post("/assistant")
def assistant(payload: AssistantRequest):
    message = payload.message.strip()

    if len(message) < 2:
        raise HTTPException(
            status_code=422,
            detail="Please enter a longer message.",
        )

    try:
        result = answer_question(message, payload.language)

        logger.info(
            "Assistant completed: language=%s intent=%s "
            "knowledge_used=%s llm_used=%s",
            result.get("language"),
            result.get("intent"),
            result.get("knowledgeUsed"),
            result.get("llmUsed"),
        )

        return result

    except Exception:
        logger.exception("Assistant workflow failed.")
        raise HTTPException(
            status_code=503,
            detail="Assistant service temporarily unavailable.",
        )
