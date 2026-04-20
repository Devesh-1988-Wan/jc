from datetime import datetime, timezone
import ast
import io
import json
import logging
import os
from pathlib import Path
import re
from typing import List, Literal, Optional
import uuid

from docx import Document
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, HTTPException, Request, UploadFile
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field
import pytesseract
from pypdf import PdfReader
from starlette.middleware.cors import CORSMiddleware
import ollama   # ✅ NEW

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "jira_db")
cors_origins = os.environ.get("CORS_ORIGINS", "*")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

report_collection = db.jira_compliance_reports
preview_collection = db.jira_compliance_previews
history_collection = db.jira_compliance_upload_history

app = FastAPI()
api_router = APIRouter(prefix="/api")

REPORT_ID = "jira-leadership-30d"

# ---------------- MODELS ---------------- #

class ComplianceMetric(BaseModel):
    model_config = ConfigDict(extra="ignore")
    metric_id: str
    title: str
    value: int = Field(ge=0, le=100)
    status: Literal["GREEN", "AMBER", "RED"]
    category: Literal["SLA", "Workflow Hygiene", "Traceability", "Quality", "Planning"]
    insight: str


class ActionItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    action_id: str
    title: str
    owner: str
    priority: Literal["P0", "P1", "P2"]
    due_in_days: int = Field(ge=1)
    status: Literal["Not Started", "In Progress", "Completed"]
    expected_impact: str


class AIContextPack(BaseModel):
    model_config = ConfigDict(extra="ignore")
    executive_narrative: str
    risk_story: str
    action_rationale: str
    leadership_talking_points: List[str]


class JiraComplianceReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    report_id: str
    title: str
    period: str
    audience: List[str]
    generated_at: str
    executive_score: int
    risk_level: Literal["Low", "Medium", "High"]
    key_message: str
    metrics: List[ComplianceMetric]
    top_risks: List[str]
    recommendations: List[str]
    actions: List[ActionItem]
    ai_context: AIContextPack


# ---------------- AI FUNCTIONS (OLLAMA) ---------------- #

def safe_json_extract(text: str):
    try:
        if "{" in text:
            text = text[text.find("{"): text.rfind("}") + 1]
        return json.loads(text)
    except:
        return {}


async def generate_ai_context(report: JiraComplianceReport) -> AIContextPack:
    try:
        prompt = f"""
Return ONLY JSON:
{{
 "executive_narrative": "...",
 "risk_story": "...",
 "action_rationale": "...",
 "leadership_talking_points": ["...", "...", "...", "..."]
}}

DATA:
{json.dumps(report.model_dump(), indent=2)}
"""

        res = ollama.chat(
            model="llama3",
            messages=[{"role": "user", "content": prompt}]
        )

        data = safe_json_extract(res["message"]["content"])

        return AIContextPack(
            executive_narrative=data.get("executive_narrative", "Not available"),
            risk_story=data.get("risk_story", "Not available"),
            action_rationale=data.get("action_rationale", "Not available"),
            leadership_talking_points=data.get("leadership_talking_points", ["Not available"]),
        )

    except Exception:
        return AIContextPack(
            executive_narrative="Fallback narrative",
            risk_story="Fallback risk",
            action_rationale="Fallback action",
            leadership_talking_points=["Fallback"],
        )


async def generate_ai_metric_pack(text: str, report: JiraComplianceReport) -> dict:
    try:
        prompt = f"""
Extract metrics JSON:
{{
 "metrics": [],
 "top_risks": [],
 "recommendations": []
}}

TEXT:
{text[:6000]}
"""

        res = ollama.chat(
            model="llama3",
            messages=[{"role": "user", "content": prompt}]
        )

        data = safe_json_extract(res["message"]["content"])

        return {
            "metrics": data.get("metrics", []),
            "top_risks": data.get("top_risks", []),
            "recommendations": data.get("recommendations", []),
        }

    except:
        return {
            "metrics": [m.model_dump() for m in report.metrics],
            "top_risks": report.top_risks,
            "recommendations": report.recommendations,
        }


# ---------------- UTIL ---------------- #

def extract_text(filename, file_bytes):
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(p.extract_text() or "" for p in reader.pages)

    if ext == ".docx":
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs)

    if ext in [".png", ".jpg", ".jpeg"]:
        img = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(img)

    return file_bytes.decode(errors="ignore")


# ---------------- API ---------------- #

@api_router.get("/")
async def root():
    return {"status": "API running"}


@api_router.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()

    text = extract_text(file.filename, content)

    report = JiraComplianceReport(
        report_id=REPORT_ID,
        title="AI Report",
        period="Latest",
        audience=["Leadership"],
        generated_at=datetime.now(timezone.utc).isoformat(),
        executive_score=50,
        risk_level="Medium",
        key_message="Generated",
        metrics=[],
        top_risks=[],
        recommendations=[],
        actions=[],
        ai_context=AIContextPack(
            executive_narrative="",
            risk_story="",
            action_rationale="",
            leadership_talking_points=[]
        )
    )

    ai_data = await generate_ai_metric_pack(text, report)
    report.top_risks = ai_data["top_risks"]
    report.recommendations = ai_data["recommendations"]

    report.ai_context = await generate_ai_context(report)

    return report


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)