from datetime import datetime, timezone
import io
import json
import os
import uuid
from pathlib import Path
from typing import List, Literal

from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from docx import Document
from PIL import Image
import pytesseract
from pypdf import PdfReader
import ollama

# ---------------- CONFIG ---------------- #

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "jira_db")

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
    metric_id: str
    title: str
    value: int = Field(ge=0, le=100)
    status: Literal["GREEN", "AMBER", "RED"]
    category: Literal["SLA", "Workflow Hygiene", "Traceability", "Quality", "Planning"]
    insight: str


class ActionItem(BaseModel):
    action_id: str
    title: str
    owner: str
    priority: Literal["P0", "P1", "P2"]
    due_in_days: int
    status: Literal["Not Started", "In Progress", "Completed"]
    expected_impact: str


class AIContextPack(BaseModel):
    executive_narrative: str
    risk_story: str
    action_rationale: str
    leadership_talking_points: List[str]


class JiraComplianceReport(BaseModel):
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


def safe_json_extract(text: str):
    try:
        if "{" in text:
            text = text[text.find("{"): text.rfind("}") + 1]
        return json.loads(text)
    except:
        return {}


# ---------------- AI ---------------- #

async def generate_ai_context(report: JiraComplianceReport) -> AIContextPack:
    try:
        prompt = f"""
Return ONLY JSON:
{{
 "executive_narrative": "...",
 "risk_story": "...",
 "action_rationale": "...",
 "leadership_talking_points": ["...", "..."]
}}
DATA:
{json.dumps(report.model_dump(), indent=2)}
"""
        res = ollama.chat(model="llama3", messages=[{"role": "user", "content": prompt}])
        data = safe_json_extract(res["message"]["content"])

        return AIContextPack(
            executive_narrative=data.get("executive_narrative", "Not available"),
            risk_story=data.get("risk_story", "Not available"),
            action_rationale=data.get("action_rationale", "Not available"),
            leadership_talking_points=data.get("leadership_talking_points", ["Not available"]),
        )
    except:
        return AIContextPack(
            executive_narrative="Fallback",
            risk_story="Fallback",
            action_rationale="Fallback",
            leadership_talking_points=["Fallback"],
        )


# ---------------- ROUTES ---------------- #

@api_router.get("/")
async def root():
    return {"status": "API running"}


# ✅ PREVIEW
@api_router.post("/report/upload-preview")
async def upload_preview(file: UploadFile = File(...)):
    content = await file.read()
    text = extract_text(file.filename, content)

    report = JiraComplianceReport(
        report_id=REPORT_ID,
        title="AI Generated Report",
        period="Latest",
        audience=["Leadership"],
        generated_at=datetime.now(timezone.utc).isoformat(),
        executive_score=50,
        risk_level="Medium",
        key_message="Generated via AI",
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

    report.ai_context = await generate_ai_context(report)

    preview_id = str(uuid.uuid4())

    await preview_collection.insert_one({
        "preview_id": preview_id,
        "report": report.model_dump(),
        "uploaded_filename": file.filename,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "preview_id": preview_id,
        "report": report,
        "uploaded_filename": file.filename,
        "missing_fields": [],
        "warnings": []
    }


# ✅ APPLY
@api_router.post("/report/apply-preview/{preview_id}")
async def apply_preview(preview_id: str):
    preview = await preview_collection.find_one({"preview_id": preview_id})
    if not preview:
        raise HTTPException(404, "Preview not found")

    report = preview["report"]

    await report_collection.update_one(
        {"report_id": REPORT_ID},
        {"$set": report},
        upsert=True
    )

    history_id = str(uuid.uuid4())

    await history_collection.insert_one({
        "history_id": history_id,
        "preview_id": preview_id,
        "uploaded_filename": preview.get("uploaded_filename"),
        "uploaded_at": datetime.now(timezone.utc),
        "report": report,
        "executive_score": report.get("executive_score"),
        "risk_level": report.get("risk_level"),
        "red_controls": 0
    })

    return report


# ✅ GET REPORT
@api_router.get("/report")
async def get_report():
    report = await report_collection.find_one({"report_id": REPORT_ID})
    if not report:
        raise HTTPException(404, "No report found")
    return report


# ✅ HISTORY
@api_router.get("/report/upload-history")
async def get_history():
    results = []
    async for doc in history_collection.find().sort("uploaded_at", -1):
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


# ✅ ROLLBACK
@api_router.post("/report/rollback/{history_id}")
async def rollback(history_id: str, options: dict):
    history = await history_collection.find_one({"history_id": history_id})
    if not history:
        raise HTTPException(404, "History not found")

    current = await report_collection.find_one({"report_id": REPORT_ID})
    if not current:
        raise HTTPException(404, "No current report")

    rollback_report = current.copy()

    if options.get("restore_summary"):
        rollback_report["executive_score"] = history["report"].get("executive_score")
        rollback_report["risk_level"] = history["report"].get("risk_level")

    if options.get("restore_metrics"):
        rollback_report["metrics"] = history["report"].get("metrics")

    if options.get("restore_risks"):
        rollback_report["top_risks"] = history["report"].get("top_risks")

    if options.get("restore_recommendations"):
        rollback_report["recommendations"] = history["report"].get("recommendations")

    if options.get("restore_actions"):
        rollback_report["actions"] = history["report"].get("actions")

    if options.get("restore_narratives"):
        rollback_report["ai_context"] = history["report"].get("ai_context")

    await report_collection.update_one(
        {"report_id": REPORT_ID},
        {"$set": rollback_report},
        upsert=True
    )

    return rollback_report


# ✅ UPDATE ACTION STATUS (NEW FIX)
@api_router.patch("/report/actions/{action_id}")
async def update_action_status(action_id: str, payload: dict):
    report = await report_collection.find_one({"report_id": REPORT_ID})

    if not report:
        raise HTTPException(404, "Report not found")

    actions = report.get("actions", [])
    updated = False

    for action in actions:
        if action["action_id"] == action_id:
            action["status"] = payload.get("status", action["status"])
            updated = True
            break

    if not updated:
        raise HTTPException(404, "Action not found")

    await report_collection.update_one(
        {"report_id": REPORT_ID},
        {"$set": {"actions": actions}}
    )

    return {"status": "updated"}


# ---------------- APP ---------------- #

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)