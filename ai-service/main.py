
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

from graph import answer_question


# --------------------------------------------------
# LOGGING CONFIGURATION
# --------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger("mahila_kaamsetu.api")


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="Mahila KaamSetu AI Service",
    version="1.1.0",
    description="Multilingual AI assistant for rural women."
)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
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


# --------------------------------------------------
# REQUEST MODEL
# --------------------------------------------------

class AssistantRequest(BaseModel):

    message: str = Field(
        min_length=2,
        max_length=3000
    )

    language: Literal["mr", "hi", "en"] = "mr"


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/")
def root():

    return {
        "ok": True,
        "service": "Mahila KaamSetu AI Service",
        "version": "1.1.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "assistant": "/assistant",
            "documentation": "/docs",
            "openapi": "/openapi.json"
        }
    }


# --------------------------------------------------
# HEALTH CHECK ENDPOINT
# --------------------------------------------------

@app.get("/health")
def health():

    return {
        "ok": True,
        "service": "mahila-kaamsetu-ai",
        "graph": "langgraph"
    }


# --------------------------------------------------
# AI ASSISTANT ENDPOINT
# --------------------------------------------------

@app.post("/assistant")
def assistant(payload: AssistantRequest):

    message = payload.message.strip()

    if len(message) < 2:
        raise HTTPException(
            status_code=422,
            detail="Message must contain at least two characters."
        )

    try:

        logger.info(
            "Received assistant request: language=%s, message_length=%d",
            payload.language,
            len(message)
        )

        # Process the question using LangGraph
        result = answer_question(
            message,
            payload.language
        )

        logger.info(
            "Assistant request completed: intent=%s, knowledgeUsed=%s, llmUsed=%s",
            result.get("intent"),
            result.get("knowledgeUsed"),
            result.get("llmUsed")
        )

        return result

    except ValueError as exc:

        logger.warning(
            "Invalid assistant request: %s",
            str(exc)
        )

        raise HTTPException(
            status_code=422,
            detail=str(exc)
        )

    except Exception:

        logger.exception(
            "Assistant processing failed."
        )

        raise HTTPException(
            status_code=503,
            detail="The AI assistant is temporarily unavailable. Please try again later."
        )


# --------------------------------------------------
# APPLICATION STARTUP
# --------------------------------------------------

@app.on_event("startup")
async def startup_event():

    logger.info(
        "Mahila KaamSetu AI Service started successfully."
    )

    logger.info(
        "Available API endpoints: /, /health, /assistant, /docs"
    )