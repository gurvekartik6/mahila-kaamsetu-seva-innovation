"""LangGraph workflow for the Mahila KaamSetu multilingual support assistant."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import TypedDict, Literal

from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).with_name(".env"))
KNOWLEDGE = json.loads(Path(__file__).with_name("knowledge.json").read_text(encoding="utf-8"))

class AssistantState(TypedDict, total=False):
    message: str
    language: str
    intent: str
    retrieved: list[dict]
    context: str
    answer: str
    needs_human: bool
    used_llm: bool

def required_message(state: AssistantState) -> str:
    message = state.get("message")
    if not message or not message.strip():
        raise ValueError("Assistant state requires a non-empty message.")
    return message.strip()

def classify(state: AssistantState) -> dict:
    msg = required_message(state).lower()
    if any(x in msg for x in ["emergency", "danger", "unsafe", "violence", "धोका", "तातडी", "हिंसा", "आपत्कालीन", "संकट"]):
        intent = "emergency"
    elif any(x in msg for x in ["scheme", "सरकारी", "योजना", "शासकीय", "अनुदान", "benefit", "लाभ"]):
        intent = "government_scheme"
    elif any(x in msg for x in ["job", "work", "training", "काम", "नोकरी", "प्रशिक्षण", "रोजगार", "शिवणकाम"]):
        intent = "employment"
    elif any(x in msg for x in ["otp", "password", "aadhaar", "आधार", "ओटीपी", "पासवर्ड", "बँक", "bank"]):
        intent = "privacy_safety"
    else:
        intent = "general"
    return {"intent": intent}

def retrieve(state: AssistantState) -> dict:
    msg = required_message(state).lower()
    matches = [item for item in KNOWLEDGE if any(term.lower() in msg for term in item["keywords"])]
    if state.get("intent") == "emergency":
        matches = [item for item in KNOWLEDGE if item["topic"] == "Emergency"]
    language = state.get("language", "mr")
    context = "\n".join(
        f"{item['topic']}: {item.get('answer_' + language, item['answer_en'])}"
        for item in matches[:3]
    )
    return {"retrieved": matches[:3], "context": context}

def compose(state: AssistantState) -> dict:
    language = state.get("language", "mr")
    context = state.get("context", "")
    message = required_message(state)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key and context:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
            language_name = {"mr": "Marathi", "hi": "Hindi", "en": "English"}.get(language, "Marathi")
            prompt = (
                "You are Mahila KaamSetu, a careful rural-women support assistant. "
                f"Answer in {language_name}. Use only the supplied context for factual claims. "
                "Do not claim eligibility is verified or a request was submitted. "
                "Never request OTPs, passwords, full Aadhaar numbers, or bank secrets. "
                "If the context is insufficient, say so and direct the user to an official source. "
                "Keep the answer clear, respectful, and easy to understand.\n\n"
                f"Guidance context:\n{context}\n\nUser question:\n{message}"
            )
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=700),
            )
            answer = (response.text or "").strip()
            if answer:
                return {"answer": answer[:5000], "used_llm": True}
        except Exception as exc:
            # Do not expose provider errors or secrets; deterministic guidance remains available.
            logger.warning(
                "Gemini response failed; using deterministic guidance (%s).",
                type(exc).__name__,
            )

    fallback = {
        "mr": "मला याबद्दल खात्रीशीर माहिती उपलब्ध नाही. कृपया प्रश्न थोडा स्पष्ट करा किंवा संबंधित अधिकृत कार्यालय/संकेतस्थळावरून माहिती तपासा.",
        "hi": "मेरे पास सत्यापित जानकारी नहीं है। कृपया प्रश्न स्पष्ट करें या आधिकारिक कार्यालय/वेबसाइट से जाँचें।",
        "en": "I don't have verified information for that yet. Please clarify your question or check the relevant official office or website.",
    }
    return {"answer": context or fallback.get(language, fallback["mr"]), "used_llm": False}

def escalation(state: AssistantState) -> dict:
    return {"needs_human": state.get("intent") == "emergency"}

builder = StateGraph(AssistantState)
builder.add_node("classify_intent", classify)
builder.add_node("retrieve_guidance", retrieve)
builder.add_node("compose_answer", compose)
builder.add_node("safety_escalation", escalation)
builder.set_entry_point("classify_intent")
builder.add_edge("classify_intent", "retrieve_guidance")
builder.add_edge("retrieve_guidance", "compose_answer")
builder.add_edge("compose_answer", "safety_escalation")
builder.add_edge("safety_escalation", END)
graph = builder.compile()

def answer_question(message: str, language: Literal["mr", "hi", "en"] = "mr") -> dict:
    result = graph.invoke({"message": message, "language": language})
    return {
        "answer": result.get("answer", ""),
        "language": language,
        "intent": result.get("intent", "general"),
        "needsHumanSupport": bool(result.get("needs_human", False)),
        "knowledgeUsed": bool(result.get("retrieved")),
        "llmUsed": bool(result.get("used_llm", False)),
        "disclaimer": {
            "mr": "ही माहिती सर्वसाधारण मार्गदर्शन आहे; अधिकृत पात्रता किंवा सेवा मंजुरी नाही.",
            "hi": "यह सामान्य मार्गदर्शन है, आधिकारिक पात्रता या सेवा स्वीकृति नहीं।",
            "en": "This is general guidance, not official eligibility or service approval.",
        }.get(language, "This is general guidance, not official eligibility or service approval."),
    }
