
from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import TypedDict, Literal

from dotenv import load_dotenv
from langgraph.graph import StateGraph, END

logger = logging.getLogger("mahila_kaamsetu.graph")

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

with (BASE_DIR / "knowledge.json").open(encoding="utf-8") as file:
    KNOWLEDGE = json.load(file)


class AssistantState(TypedDict, total=False):
    message: str
    language: str
    intent: str
    retrieved: list[dict]
    context: str
    answer: str
    needs_human: bool
    used_llm: bool


TERMS = {
    "emergency": [
        "emergency", "danger", "unsafe", "violence", "threat",
        "धोका", "तातडी", "हिंसा", "आपत्कालीन", "संकट",
        "मला वाचवा", "मारहाण", "सुरक्षित नाही",
        "खतरा", "बचाओ", "असुरक्षित", "आपातकाल",
    ],
    "privacy_safety": [
        "otp", "password", "aadhaar", "aadhar", "bank",
        "ओटीपी", "पासवर्ड", "आधार", "बँक", "बैंक",
        "खाते क्रमांक", "account number", "pin",
    ],
    "government_scheme": [
        "scheme", "government", "benefit", "subsidy", "grant",
        "financial assistance", "सरकारी", "शासकीय", "योजना",
        "अनुदान", "लाभ", "सरकारी मदत", "आर्थिक मदत",
        "सरकारी सहायता", "आर्थिक सहायता",
    ],
    "employment": [
        "job", "work", "employment", "training", "skill",
        "sewing", "tailoring", "livelihood", "self employment",
        "काम", "नोकरी", "प्रशिक्षण", "शिवणकाम", "शिलाई",
        "रोजगार", "काम मिळेल", "काम पाहिजे", "काम हवे",
        "नोकरी पाहिजे", "व्यवसाय", "कौशल्य",
        "नौकरी", "सिलाई", "काम चाहिए", "नौकरी चाहिए",
    ],
}

TOPIC_FOR_INTENT = {
    "emergency": ["Emergency"],
    "privacy_safety": ["General safety"],
    "government_scheme": ["Government schemes"],
    "employment": ["Employment and training"],
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).casefold()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def contains_term(message: str, term: str) -> bool:
    message_words = f" {normalize(message)} "
    term_words = f" {normalize(term)} "
    return term_words in message_words


def required_message(state: AssistantState) -> str:
    message = state.get("message", "").strip()
    if not message:
        raise ValueError("Assistant state requires a non-empty message.")
    return message


def classify(state: AssistantState) -> dict:
    message = required_message(state)

    # Safety-sensitive requests are classified first.
    for intent in (
        "emergency",
        "privacy_safety",
        "government_scheme",
        "employment",
    ):
        if any(
            contains_term(message, term)
            for term in TERMS[intent]
        ):
            return {"intent": intent}

    return {"intent": "general"}


def retrieve(state: AssistantState) -> dict:
    message = required_message(state)
    intent = state.get("intent", "general")
    language = state.get("language", "mr")

    matches = [
        item for item in KNOWLEDGE
        if any(
            contains_term(message, keyword)
            for keyword in item.get("keywords", [])
        )
    ]

    # Use the classified topic when an alternate wording misses
    # the keywords in knowledge.json.
    if not matches:
        topics = TOPIC_FOR_INTENT.get(intent, [])
        matches = [
            item for item in KNOWLEDGE
            if item.get("topic") in topics
        ]

    if intent == "emergency":
        emergency_items = [
            item for item in KNOWLEDGE
            if item.get("topic") == "Emergency"
        ]
        matches = emergency_items or matches

    matches = matches[:3]

    context_parts = []
    for item in matches:
        answer = item.get(
            f"answer_{language}",
            item.get("answer_en", ""),
        )
        if answer:
            context_parts.append(
                f"{item.get('topic', 'Guidance')}: {answer}"
            )

    context = "\n".join(context_parts)

    logger.info(
        "Retrieval completed: intent=%s matches=%d language=%s",
        intent,
        len(matches),
        language,
    )

    return {"retrieved": matches, "context": context}


def safe_error_details(exc: Exception) -> str:
    """Return useful provider diagnostics without logging secrets."""
    code = getattr(exc, "code", None)
    status = getattr(exc, "status_code", None)
    message = getattr(exc, "message", None) or str(exc)

    # Redact common API-key patterns and cap the diagnostic length.
    message = re.sub(
        r"(?i)(api[_ -]?key|key)\s*[:=]\s*[^\s,;]+",
        r"\1=[REDACTED]",
        message,
    )
    message = re.sub(
        r"\bAIza[0-9A-Za-z_-]{20,}\b",
        "[REDACTED_KEY]",
        message,
    )
    message = re.sub(
        r"\bAQ\.[0-9A-Za-z._-]{20,}\b",
        "[REDACTED_KEY]",
        message,
    )

    return (
        f"type={type(exc).__name__}, "
        f"code={code}, status={status}, "
        f"message={message[:350]}"
    )


def compose(state: AssistantState) -> dict:
    language = state.get("language", "mr")
    context = state.get("context", "").strip()
    message = required_message(state)

    fallback = {
        "mr": (
            "माफ करा, या प्रश्नासाठी माझ्याकडे पुरेशी "
            "पडताळलेली माहिती नाही. कृपया संबंधित अधिकृत "
            "कार्यालय किंवा सरकारी संकेतस्थळावर तपासा."
        ),
        "hi": (
            "क्षमा करें, इस प्रश्न के लिए मेरे पास पर्याप्त "
            "सत्यापित जानकारी नहीं है। कृपया संबंधित सरकारी "
            "कार्यालय या आधिकारिक वेबसाइट पर जाँचें।"
        ),
        "en": (
            "I don't have enough verified information to answer "
            "this question. Please check the relevant official "
            "office or government website."
        ),
    }

    # Do not generate unsupported factual answers without context.
    if not context:
        logger.warning("No relevant knowledge context was retrieved.")
        return {
            "answer": fallback.get(language, fallback["mr"]),
            "used_llm": False,
        }

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "").strip()

    if not api_key:
        logger.error("GEMINI_API_KEY is missing from the AI service environment.")
        return {"answer": context, "used_llm": False}

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        language_name = {
            "mr": "Marathi",
            "hi": "Hindi",
            "en": "English",
        }.get(language, "Marathi")

        prompt = f"""
You are Mahila KaamSetu, a careful support assistant for rural women.

Answer in {language_name}, using simple, respectful language.
Answer the user's actual question, not just its general topic.
Use only the trusted guidance below for factual claims.
Do not invent schemes, benefits, eligibility, documents, deadlines,
job openings, locations, telephone numbers, or application links.
If the guidance does not answer a detail, clearly say that it
is not available in the supplied information.
Never ask for OTPs, passwords, full Aadhaar numbers, or bank secrets.
Never claim a request was submitted or a human was contacted.
Give one practical next step when possible.

Trusted guidance:
{context}

User's question:
{message}
""".strip()

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=700,
            ),
        )

        answer = (response.text or "").strip()

        if answer:
            logger.info("Gemini generated an answer successfully.")
            return {
                "answer": answer[:5000],
                "used_llm": True,
            }

        logger.warning("Gemini returned an empty response.")

    except Exception as exc:
        logger.error(
            "Gemini request failed: %s",
            safe_error_details(exc),
        )

    # Keep the service usable if Gemini is unavailable.
    return {"answer": context, "used_llm": False}


def escalation(state: AssistantState) -> dict:
    return {
        "needs_human": state.get("intent") == "emergency"
    }


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


def answer_question(
    message: str,
    language: Literal["mr", "hi", "en"] = "mr",
) -> dict:
    message = message.strip()

    if len(message) < 2:
        raise ValueError("Message must contain at least two characters.")

    result = graph.invoke({
        "message": message,
        "language": language,
    })

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
