from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from graph import answer_question
app=FastAPI(title="Mahila KaamSetu AI Service",version="1.0.0")
class AssistantRequest(BaseModel):
    message:str=Field(min_length=2,max_length=3000)
    language:Literal["mr","hi","en"]="mr"
@app.get("/health")
def health(): return {"ok":True,"service":"mahila-kaamsetu-ai","graph":"langgraph"}
@app.post("/assistant")
def assistant(payload:AssistantRequest):
    try: return answer_question(payload.message.strip(),payload.language)
    except Exception as exc: raise HTTPException(status_code=503,detail="Assistant service temporarily unavailable.") from exc
