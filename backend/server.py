from datetime import datetime, timezone
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
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field
import pytesseract
from pypdf import PdfReader
from starlette.middleware.cors import CORSMiddleware
from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
cors_origins = os.environ["CORS_ORIGINS"]

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
report_collection = db.jira_compliance_reports
preview_collection = db.jira_compliance_previews
history_collection = db.jira_compliance_upload_history

app = FastAPI()
api_router = APIRouter(prefix="/api")

REPORT_ID = "jira-leadership-30d"


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


class KpiDefinition(BaseModel):
    model_config = ConfigDict(extra="ignore")

    metric_id: str
    definition: str
    target: str
    current_status: str


class LeadershipNarrative(BaseModel):
    model_config = ConfigDict(extra="ignore")

    what_happened: str
    why_it_matters: str
    recommendation: str


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
    executive_score: int = Field(ge=0, le=100)
    risk_level: Literal["Low", "Medium", "High"]
    key_message: str
    metrics: List[ComplianceMetric]
    top_risks: List[str]
    recommendations: List[str]
    actions: List[ActionItem]
    kpi_definitions: List[KpiDefinition]
    narratives: List[LeadershipNarrative]
    ai_context: AIContextPack


class ReportSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")

    period: str
    executive_score: int
    risk_level: str
    total_controls: int
    green_controls: int
    amber_controls: int
    red_controls: int


class ActionStatusUpdate(BaseModel):
    status: Literal["Not Started", "In Progress", "Completed"]


class UploadPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    preview_id: str
    uploaded_filename: str
    report: JiraComplianceReport
    missing_fields: List[str]
    warnings: List[str]


class UploadHistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    history_id: str
    preview_id: str
    uploaded_filename: str
    uploaded_at: str
    period: str
    executive_score: int
    risk_level: str
    red_controls: int


class RollbackOptions(BaseModel):
    restore_summary: bool = True
    restore_metrics: bool = True
    restore_risks: bool = True
    restore_recommendations: bool = True
    restore_actions: bool = True
    restore_kpi_definitions: bool = True
    restore_narratives: bool = True


class WidgetUpdatePayload(BaseModel):
    period: Optional[str] = None
    executive_score: Optional[int] = Field(default=None, ge=0, le=100)
    risk_level: Optional[Literal["Low", "Medium", "High"]] = None
    key_message: Optional[str] = None
    metrics: Optional[List[ComplianceMetric]] = None
    top_risks: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    actions: Optional[List[ActionItem]] = None
    kpi_definitions: Optional[List[KpiDefinition]] = None
    narratives: Optional[List[LeadershipNarrative]] = None


def build_fallback_ai_context(key_message: str, top_risks: List[str], recommendations: List[str]) -> AIContextPack:
    return AIContextPack(
        executive_narrative=f"Leadership context: {key_message}",
        risk_story="Primary operational risk exposure is concentrated in control gaps highlighted by red/amber findings.",
        action_rationale="Recommended actions prioritize traceability, SLA recovery, and quality closure controls to reduce delivery risk.",
        leadership_talking_points=[
            top_risks[0] if top_risks else "Top risk not available",
            recommendations[0] if recommendations else "Recommendation not available",
            "Track corrective action completion weekly with executive visibility.",
        ],
    )


async def generate_ai_context(report: JiraComplianceReport) -> AIContextPack:
    try:
        key = os.environ["EMERGENT_LLM_KEY"]
        chat = LlmChat(
            api_key=key,
            session_id=f"jira-context-{uuid.uuid4()}",
            system_message=(
                "You are a compliance strategy assistant. Return strict JSON only with keys: "
                "executive_narrative, risk_story, action_rationale, leadership_talking_points. "
                "leadership_talking_points must be an array of 4 concise bullet strings."
            ),
        ).with_model("openai", "gpt-5.2")

        prompt = {
            "period": report.period,
            "executive_score": report.executive_score,
            "risk_level": report.risk_level,
            "key_message": report.key_message,
            "top_risks": report.top_risks,
            "recommendations": report.recommendations,
            "metrics": [metric.model_dump() for metric in report.metrics],
        }

        response = await chat.send_message(UserMessage(text=json.dumps(prompt)))
        payload = response.strip()

        if "{" in payload and "}" in payload:
            payload = payload[payload.find("{") : payload.rfind("}") + 1]

        ai_data = json.loads(payload)
        talking_points = ai_data.get("leadership_talking_points", [])
        if not isinstance(talking_points, list):
            talking_points = [str(talking_points)]

        return AIContextPack(
            executive_narrative=str(ai_data.get("executive_narrative", "Not available")),
            risk_story=str(ai_data.get("risk_story", "Not available")),
            action_rationale=str(ai_data.get("action_rationale", "Not available")),
            leadership_talking_points=[str(point) for point in talking_points[:6]] or ["Not available"],
        )
    except Exception:
        return build_fallback_ai_context(report.key_message, report.top_risks, report.recommendations)


def build_seed_report() -> dict:
    metrics = [
        {
            "metric_id": "AUD-01",
            "title": "Bugs without bug owner",
            "value": 11,
            "status": "AMBER",
            "category": "Workflow Hygiene",
            "insight": "Ownership gaps slow defect triage and accountability.",
        },
        {
            "metric_id": "AUD-02",
            "title": "Tasks/sub-tasks with missing estimates",
            "value": 0,
            "status": "GREEN",
            "category": "Planning",
            "insight": "Estimation discipline for tasks is strong.",
        },
        {
            "metric_id": "AUD-03",
            "title": "Bugs/defects with missing estimates",
            "value": 4,
            "status": "GREEN",
            "category": "Planning",
            "insight": "Bug estimation coverage is mostly complete.",
        },
        {
            "metric_id": "AUD-04",
            "title": "Tasks/sub-tasks with missing parent links",
            "value": 62,
            "status": "RED",
            "category": "Traceability",
            "insight": "Missing parent links reduce release traceability and forecasting quality.",
        },
        {
            "metric_id": "AUD-05",
            "title": "Bugs/defects with missing parent links",
            "value": 97,
            "status": "RED",
            "category": "Traceability",
            "insight": "Nearly all bug items are disconnected from parent workstreams.",
        },
        {
            "metric_id": "AUD-06",
            "title": "Open sub-tasks with done parent",
            "value": 0,
            "status": "GREEN",
            "category": "Workflow Hygiene",
            "insight": "Parent-child closure sequencing is compliant.",
        },
        {
            "metric_id": "AUD-07",
            "title": "Tasks closed without assignee",
            "value": 0,
            "status": "GREEN",
            "category": "Workflow Hygiene",
            "insight": "Assignee controls are working effectively.",
        },
        {
            "metric_id": "AUD-08",
            "title": "Tasks closed without work log",
            "value": 10,
            "status": "AMBER",
            "category": "Workflow Hygiene",
            "insight": "Work-log completeness needs stronger closure checks.",
        },
        {
            "metric_id": "AUD-09",
            "title": "Tasks closed without original estimate",
            "value": 4,
            "status": "GREEN",
            "category": "Planning",
            "insight": "Original estimate capture is stable.",
        },
        {
            "metric_id": "AUD-10",
            "title": "Root cause missing",
            "value": 46,
            "status": "RED",
            "category": "Quality",
            "insight": "Missing root-cause data weakens prevention of recurring incidents.",
        },
        {
            "metric_id": "AUD-11",
            "title": "Development completion date compliance",
            "value": 52,
            "status": "RED",
            "category": "SLA",
            "insight": "Half the tickets miss committed development completion dates.",
        },
        {
            "metric_id": "AUD-12",
            "title": "Done tickets mapped to fix version",
            "value": 5,
            "status": "GREEN",
            "category": "Traceability",
            "insight": "Release fix-version hygiene is strong.",
        },
        {
            "metric_id": "AUD-13",
            "title": "Priority 1 tickets not resolved",
            "value": 44,
            "status": "RED",
            "category": "SLA",
            "insight": "High-severity incidents remain unresolved for extended periods.",
        },
        {
            "metric_id": "AUD-14",
            "title": "Tickets reopened after done",
            "value": 9,
            "status": "AMBER",
            "category": "Quality",
            "insight": "Reopen rate suggests inconsistent acceptance quality.",
        },
        {
            "metric_id": "AUD-15",
            "title": "Resolution within threshold for bugs",
            "value": 68,
            "status": "RED",
            "category": "SLA",
            "insight": "Bug resolution speed remains below agreed thresholds.",
        },
        {
            "metric_id": "AUD-16",
            "title": "Resolution within threshold for defects",
            "value": 52,
            "status": "RED",
            "category": "SLA",
            "insight": "Defect closure timeliness is materially below target.",
        },
        {
            "metric_id": "AUD-17",
            "title": "Long-open bugs/defects (>3 weeks)",
            "value": 40,
            "status": "RED",
            "category": "SLA",
            "insight": "Aging backlog is increasing operational and delivery risk.",
        },
    ]

    kpi_definitions = [
        {
            "metric_id": metric["metric_id"],
            "definition": metric["title"],
            "target": "GREEN <= 5%, AMBER 6-15%, RED > 15%",
            "current_status": metric["status"],
        }
        for metric in metrics
    ]

    return {
        "report_id": REPORT_ID,
        "title": "Jira Compliance Leadership Report",
        "period": "Last 30 days",
        "audience": [
            "C-level executives",
            "VP/Directors",
            "Engineering/Product leadership",
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "executive_score": 54,
        "risk_level": "High",
        "key_message": "Traceability and SLA adherence are the largest compliance risks in the last 30 days.",
        "metrics": metrics,
        "top_risks": [
            "97% of bugs/defects are missing parent links (AUD-05).",
            "44% of P1 tickets remain unresolved (AUD-13).",
            "Resolution threshold compliance is red for bugs (AUD-15) and defects (AUD-16).",
            "46% of issues are missing root-cause details (AUD-10).",
        ],
        "recommendations": [
            "Enforce parent-link validation before moving issues into Done.",
            "Require root-cause field completion for every Sev1/Sev2 and reopened ticket.",
            "Create a weekly SLA control tower for P1 and aging defect review.",
            "Gate issue closure on mandatory worklog and quality verification checklist.",
        ],
        "actions": [
            {
                "action_id": "ACT-01",
                "title": "Deploy parent-link workflow validator",
                "owner": "Engineering Operations",
                "priority": "P0",
                "due_in_days": 7,
                "status": "In Progress",
                "expected_impact": "Reduce missing parent links below 20% in 30 days.",
            },
            {
                "action_id": "ACT-02",
                "title": "Launch P1 resolution war-room cadence",
                "owner": "Incident Management",
                "priority": "P0",
                "due_in_days": 3,
                "status": "Not Started",
                "expected_impact": "Bring unresolved P1 tickets below 15%.",
            },
            {
                "action_id": "ACT-03",
                "title": "Mandate root-cause completion in close transition",
                "owner": "Quality Engineering",
                "priority": "P1",
                "due_in_days": 10,
                "status": "In Progress",
                "expected_impact": "Improve RCA completion from 54% to 85%.",
            },
            {
                "action_id": "ACT-04",
                "title": "Implement QA sign-off for Done transition",
                "owner": "Release Management",
                "priority": "P1",
                "due_in_days": 14,
                "status": "Not Started",
                "expected_impact": "Decrease reopen rate from 9% to below 5%.",
            },
            {
                "action_id": "ACT-05",
                "title": "Publish weekly aging backlog heatmap",
                "owner": "PMO",
                "priority": "P2",
                "due_in_days": 12,
                "status": "Completed",
                "expected_impact": "Increase visibility and reduce >3 week aged bugs by 25%.",
            },
        ],
        "kpi_definitions": kpi_definitions,
        "narratives": [
            {
                "what_happened": "Planning hygiene is stable, but traceability controls are under-performing.",
                "why_it_matters": "Disconnected work items reduce confidence in release forecasting and root cause accountability.",
                "recommendation": "Prioritize automation gates in workflow transitions before the next quarter planning cycle.",
            },
            {
                "what_happened": "SLA attainment for defects and bugs remains below expected thresholds.",
                "why_it_matters": "Slow remediation increases customer-facing risk and escalations.",
                "recommendation": "Run a focused SLA sprint on P1/P2 aging issues with daily leadership check-ins.",
            },
        ],
        "ai_context": {
            "executive_narrative": "Leadership context: Traceability and SLA adherence are the largest compliance risks in the last 30 days.",
            "risk_story": "Risk concentration is highest in parent-link traceability and resolution threshold controls.",
            "action_rationale": "Action plan focuses on workflow guardrails, RCA discipline, and faster P1/P2 closure velocity.",
            "leadership_talking_points": [
                "Traceability controls require immediate workflow gating.",
                "SLA misses on bugs and defects remain above acceptable thresholds.",
                "Root-cause completion is necessary for repeat-incident reduction.",
                "Weekly executive action review should stay in place until red controls drop.",
            ],
        },
    }


def infer_category(metric_title: str) -> Literal["SLA", "Workflow Hygiene", "Traceability", "Quality", "Planning"]:
    title = metric_title.lower()
    if "parent" in title or "trace" in title or "fix version" in title:
        return "Traceability"
    if "resolution" in title or "priority" in title or "long-open" in title or "completion date" in title:
        return "SLA"
    if "root cause" in title or "reopen" in title:
        return "Quality"
    if "estimate" in title:
        return "Planning"
    return "Workflow Hygiene"


def infer_status_from_value(value: int) -> Literal["GREEN", "AMBER", "RED"]:
    if value <= 5:
        return "GREEN"
    if value <= 15:
        return "AMBER"
    return "RED"


def build_kpi_definitions_from_metrics(metrics: List[dict]) -> List[dict]:
    return [
        {
            "metric_id": metric["metric_id"],
            "definition": metric["title"],
            "target": "GREEN <= 5%, AMBER 6-15%, RED > 15%",
            "current_status": metric["status"],
        }
        for metric in metrics
    ]


def parse_metrics_from_text(text: str) -> List[dict]:
    normalized_text = re.sub(r"\s+", " ", text)
    patterns = [
        re.compile(
            r"(AUD-\d{2})\s*[:\-\|]?\s*(.*?)\s*[:\-\|]\s*(\d{1,3})%\s*\((GREEN|AMBER|RED)\)",
            flags=re.IGNORECASE,
        ),
        re.compile(
            r"(AUD-\d{2})\s*[:\-\|]?\s*(.*?)\s*[:\-\|]\s*(\d{1,3})%\s*\|\s*(GREEN|AMBER|RED)",
            flags=re.IGNORECASE,
        ),
        re.compile(
            r"(AUD-\d{2})\s*[:\-\|]?\s*(.*?)\s*[:\-\|]\s*(\d{1,3})%",
            flags=re.IGNORECASE,
        ),
    ]

    metrics = []
    for pattern in patterns:
        for match in pattern.finditer(normalized_text):
            metric_id = match.group(1).upper()
            title = re.sub(r"\s+", " ", match.group(2)).strip(" -*\t\n\r|")
            title = title if title else "Not available"
            value = int(match.group(3))
            value = max(0, min(value, 100))
            status = match.group(4).upper() if len(match.groups()) >= 4 and match.group(4) else infer_status_from_value(value)

            metrics.append(
                {
                    "metric_id": metric_id,
                    "title": title,
                    "value": value,
                    "status": status,
                    "category": infer_category(title),
                    "insight": "Not available" if title == "Not available" else f"Observed {value}% for {title.lower()}.",
                }
            )

    # Keep only unique metric_ids in encounter order
    deduped_metrics = []
    seen = set()
    for metric in metrics:
        if metric["metric_id"] in seen:
            continue
        seen.add(metric["metric_id"])
        deduped_metrics.append(metric)

    return deduped_metrics


def compute_executive_score(metrics: List[dict]) -> int:
    if not metrics:
        return 0
    weights = {"GREEN": 100, "AMBER": 65, "RED": 35}
    score = sum(weights.get(metric["status"], 50) for metric in metrics) / len(metrics)
    return int(round(score))


def compute_risk_level(metrics: List[dict]) -> Literal["Low", "Medium", "High"]:
    red_count = len([metric for metric in metrics if metric["status"] == "RED"])
    if red_count >= 5:
        return "High"
    if red_count >= 3:
        return "Medium"
    return "Low"


def parse_key_message(text: str) -> str:
    match = re.search(
        r"Executive Summary\s*(.+?)(?:KPIs|KPI|Compliance Findings|SLA Data|Workflow Hygiene Issues)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return "Not available"

    cleaned = re.sub(r"\s+", " ", match.group(1)).strip(" -*\n\t\r")
    return cleaned[:260] if cleaned else "Not available"


def parse_period(text: str) -> str:
    match = re.search(
        r"(last\s*30\s*days|current\s*quarter|last\s*quarter|last\s*\d+\s*days)",
        text,
        flags=re.IGNORECASE,
    )
    return match.group(1).title() if match else "Not available"


def build_recommendations(metrics: List[dict]) -> List[str]:
    recommendations = []

    if any("parent" in metric["title"].lower() for metric in metrics):
        recommendations.append("Enforce parent-link validation before transitions to Done.")
    if any("root cause" in metric["title"].lower() for metric in metrics):
        recommendations.append("Require root-cause completion for critical and reopened tickets.")
    if any(metric["category"] == "SLA" and metric["status"] == "RED" for metric in metrics):
        recommendations.append("Stand up a weekly SLA control review for aged defects and unresolved P1 items.")
    if any("work log" in metric["title"].lower() for metric in metrics):
        recommendations.append("Gate closure on mandatory work-log completion and assignee accountability.")

    if not recommendations:
        recommendations = [
            "Not available",
            "Not available",
            "Not available",
        ]

    return recommendations[:4]


def build_actions(recommendations: List[str]) -> List[dict]:
    owners = [
        "Engineering Operations",
        "Quality Engineering",
        "Incident Management",
        "PMO",
    ]

    actions = []
    for index, recommendation in enumerate(recommendations):
        actions.append(
            {
                "action_id": f"ACT-{index + 1:02d}",
                "title": recommendation,
                "owner": owners[index % len(owners)],
                "priority": "P0" if index < 2 else "P1",
                "due_in_days": 7 + (index * 3),
                "status": "Not Started",
                "expected_impact": "Not available" if recommendation == "Not available" else "Improved control compliance in next reporting cycle.",
            }
        )

    return actions


def build_report_from_uploaded_text(
    text: str,
    uploaded_filename: str,
    current_report: JiraComplianceReport,
) -> tuple[JiraComplianceReport, List[str], List[str]]:
    missing_fields = []
    warnings = []

    parsed_metrics = parse_metrics_from_text(text)
    if not parsed_metrics:
        parsed_metrics = [metric.model_dump() for metric in current_report.metrics]
        missing_fields.append("metrics")
        warnings.append("No AUD metric lines were detected; reused current dashboard metrics.")

    key_message = parse_key_message(text)
    if key_message == "Not available":
        missing_fields.append("executive_summary")
        warnings.append("Executive summary text not found; value marked as 'Not available'.")

    period = parse_period(text)
    if period == "Not available":
        missing_fields.append("period")
        warnings.append("Reporting period not detected; value marked as 'Not available'.")

    recommendations = build_recommendations(parsed_metrics)
    if recommendations and recommendations[0] == "Not available":
        missing_fields.append("recommended_actions")

    top_risks = [
        f"{metric['value']}% · {metric['title']}"
        for metric in parsed_metrics
        if metric["status"] == "RED"
    ]
    if not top_risks:
        top_risks = ["Not available"]
        missing_fields.append("top_risks")

    kpi_definitions = build_kpi_definitions_from_metrics(parsed_metrics)

    report_payload = JiraComplianceReport(
        report_id=REPORT_ID,
        title="Jira Compliance Leadership Report",
        period=period,
        audience=current_report.audience,
        generated_at=datetime.now(timezone.utc).isoformat(),
        executive_score=compute_executive_score(parsed_metrics),
        risk_level=compute_risk_level(parsed_metrics),
        key_message=key_message,
        metrics=[ComplianceMetric(**metric) for metric in parsed_metrics],
        top_risks=top_risks[:6],
        recommendations=recommendations,
        actions=[ActionItem(**action) for action in build_actions(recommendations)],
        kpi_definitions=[KpiDefinition(**definition) for definition in kpi_definitions],
        narratives=[
            LeadershipNarrative(
                what_happened=f"Uploaded file processed: {uploaded_filename}",
                why_it_matters="Dashboard data has been refreshed using extracted controls from the uploaded document.",
                recommendation="Review preview outputs before applying to production dashboard.",
            )
        ],
        ai_context=build_fallback_ai_context(key_message, top_risks, recommendations),
    )

    return report_payload, sorted(set(missing_fields)), warnings


def extract_text_from_upload(uploaded_filename: str, file_bytes: bytes) -> str:
    extension = Path(uploaded_filename).suffix.lower()
    try:
        if extension == ".pdf":
            reader = PdfReader(io.BytesIO(file_bytes))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        if extension == ".docx":
            doc = Document(io.BytesIO(file_bytes))
            return "\n".join(paragraph.text for paragraph in doc.paragraphs)
        if extension in {".txt", ".md"}:
            return file_bytes.decode("utf-8", errors="ignore")
        if extension in {".jpg", ".jpeg", ".png"}:
            image = Image.open(io.BytesIO(file_bytes))
            return pytesseract.image_to_string(image)
        raise HTTPException(status_code=400, detail="Supported formats: PDF, DOCX, TXT, MD, JPG, JPEG, PNG")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse uploaded file: {exc}")


def build_summary(report: JiraComplianceReport) -> ReportSummary:
    green_controls = len([metric for metric in report.metrics if metric.status == "GREEN"])
    amber_controls = len([metric for metric in report.metrics if metric.status == "AMBER"])
    red_controls = len([metric for metric in report.metrics if metric.status == "RED"])

    return ReportSummary(
        period=report.period,
        executive_score=report.executive_score,
        risk_level=report.risk_level,
        total_controls=len(report.metrics),
        green_controls=green_controls,
        amber_controls=amber_controls,
        red_controls=red_controls,
    )


async def get_or_seed_report() -> JiraComplianceReport:
    doc = await report_collection.find_one({"report_id": REPORT_ID}, {"_id": 0})
    if doc:
        if "ai_context" not in doc:
            doc["ai_context"] = build_fallback_ai_context(
                doc.get("key_message", "Not available"),
                doc.get("top_risks", []),
                doc.get("recommendations", []),
            ).model_dump()
        return JiraComplianceReport(**doc)

    seed_doc = build_seed_report()
    await report_collection.insert_one(seed_doc.copy())
    return JiraComplianceReport(**seed_doc)


async def trim_history_to_limit(limit: int = 10):
    history_docs = await history_collection.find({}, {"_id": 1}).sort("uploaded_at", -1).to_list(500)
    if len(history_docs) <= limit:
        return

    ids_to_delete = [doc["_id"] for doc in history_docs[limit:]]
    await history_collection.delete_many({"_id": {"$in": ids_to_delete}})


async def save_report_snapshot(report_payload: dict) -> JiraComplianceReport:
    report_payload["report_id"] = REPORT_ID
    report_payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    await report_collection.replace_one({"report_id": REPORT_ID}, report_payload, upsert=True)
    return JiraComplianceReport(**report_payload)


def apply_widget_updates(report_data: dict, payload: WidgetUpdatePayload) -> dict:
    if payload.period is not None:
        report_data["period"] = payload.period
    if payload.executive_score is not None:
        report_data["executive_score"] = payload.executive_score
    if payload.risk_level is not None:
        report_data["risk_level"] = payload.risk_level
    if payload.key_message is not None:
        report_data["key_message"] = payload.key_message
    if payload.metrics is not None:
        metric_docs = [metric.model_dump() for metric in payload.metrics]
        report_data["metrics"] = metric_docs
        if payload.kpi_definitions is None:
            report_data["kpi_definitions"] = build_kpi_definitions_from_metrics(metric_docs)
    if payload.top_risks is not None:
        report_data["top_risks"] = payload.top_risks
    if payload.recommendations is not None:
        report_data["recommendations"] = payload.recommendations
    if payload.actions is not None:
        report_data["actions"] = [action.model_dump() for action in payload.actions]
    if payload.kpi_definitions is not None:
        report_data["kpi_definitions"] = [definition.model_dump() for definition in payload.kpi_definitions]
    if payload.narratives is not None:
        report_data["narratives"] = [narrative.model_dump() for narrative in payload.narratives]

    return report_data


@api_router.get("/")
async def root():
    return {"message": "Jira compliance reporting API online"}


@api_router.get("/report", response_model=JiraComplianceReport)
async def get_report():
    return await get_or_seed_report()


@api_router.get("/report/summary", response_model=ReportSummary)
async def get_report_summary():
    report = await get_or_seed_report()
    return build_summary(report)


@api_router.get("/report/metrics", response_model=List[ComplianceMetric])
async def get_report_metrics():
    report = await get_or_seed_report()
    return report.metrics


@api_router.get("/report/actions", response_model=List[ActionItem])
async def get_report_actions():
    report = await get_or_seed_report()
    return report.actions


@api_router.patch("/report/actions/{action_id}", response_model=ActionItem)
async def update_action_status(action_id: str, payload: ActionStatusUpdate):
    update_result = await report_collection.update_one(
        {"report_id": REPORT_ID, "actions.action_id": action_id},
        {
            "$set": {
                "actions.$.status": payload.status,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    if update_result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Action item not found")

    report = await get_or_seed_report()
    for action in report.actions:
        if action.action_id == action_id:
            return action

    raise HTTPException(status_code=404, detail="Action item not found after update")


@api_router.post("/report/upload-preview", response_model=UploadPreviewResponse)
async def upload_report_preview(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file name is missing")

    extension = Path(file.filename).suffix.lower()
    if extension not in {".pdf", ".docx", ".txt", ".md", ".jpg", ".jpeg", ".png"}:
        raise HTTPException(status_code=400, detail="Supported formats: PDF, DOCX, TXT, MD, JPG, JPEG, PNG")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    extracted_text = extract_text_from_upload(file.filename, file_bytes)
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in uploaded file")

    current_report = await get_or_seed_report()
    parsed_report, missing_fields, warnings = build_report_from_uploaded_text(
        extracted_text,
        file.filename,
        current_report,
    )

    ai_context = await generate_ai_context(parsed_report)
    parsed_report.ai_context = ai_context

    preview_id = str(uuid.uuid4())
    preview_doc = {
        "preview_id": preview_id,
        "uploaded_filename": file.filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "report": parsed_report.model_dump(),
        "missing_fields": missing_fields,
        "warnings": warnings,
    }
    await preview_collection.insert_one(preview_doc.copy())

    return UploadPreviewResponse(
        preview_id=preview_id,
        uploaded_filename=file.filename,
        report=parsed_report,
        missing_fields=missing_fields,
        warnings=warnings,
    )


@api_router.post("/report/apply-preview/{preview_id}", response_model=JiraComplianceReport)
async def apply_report_preview(preview_id: str):
    preview_doc = await preview_collection.find_one({"preview_id": preview_id}, {"_id": 0})
    if not preview_doc:
        raise HTTPException(status_code=404, detail="Preview not found")

    report_doc = preview_doc["report"]
    updated_report = await save_report_snapshot(report_doc)
    summary = build_summary(updated_report)

    history_doc = {
        "history_id": str(uuid.uuid4()),
        "preview_id": preview_id,
        "uploaded_filename": preview_doc["uploaded_filename"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "period": updated_report.period,
        "executive_score": updated_report.executive_score,
        "risk_level": updated_report.risk_level,
        "red_controls": summary.red_controls,
        "report_snapshot": updated_report.model_dump(),
    }
    await history_collection.insert_one(history_doc.copy())
    await trim_history_to_limit(limit=10)

    return updated_report


@api_router.patch("/report/widgets", response_model=JiraComplianceReport)
async def update_report_widgets(payload: WidgetUpdatePayload):
    current_report = await get_or_seed_report()
    updated_payload = apply_widget_updates(current_report.model_dump(), payload)
    refreshed_context = await generate_ai_context(JiraComplianceReport(**updated_payload))
    updated_payload["ai_context"] = refreshed_context.model_dump()
    return await save_report_snapshot(updated_payload)


@api_router.post("/report/rollback/{history_id}", response_model=JiraComplianceReport)
async def rollback_report_from_history(history_id: str, options: RollbackOptions):
    if not any(options.model_dump().values()):
        raise HTTPException(status_code=400, detail="Select at least one section to restore")

    history_doc = await history_collection.find_one({"history_id": history_id}, {"_id": 0})
    if not history_doc or "report_snapshot" not in history_doc:
        raise HTTPException(status_code=404, detail="Rollback snapshot not found")

    snapshot = history_doc["report_snapshot"]
    current_report = await get_or_seed_report()
    current_payload = current_report.model_dump()

    if options.restore_summary:
        current_payload["period"] = snapshot.get("period", current_payload["period"])
        current_payload["executive_score"] = snapshot.get("executive_score", current_payload["executive_score"])
        current_payload["risk_level"] = snapshot.get("risk_level", current_payload["risk_level"])
        current_payload["key_message"] = snapshot.get("key_message", current_payload["key_message"])
    if options.restore_metrics:
        current_payload["metrics"] = snapshot.get("metrics", current_payload["metrics"])
    if options.restore_risks:
        current_payload["top_risks"] = snapshot.get("top_risks", current_payload["top_risks"])
    if options.restore_recommendations:
        current_payload["recommendations"] = snapshot.get("recommendations", current_payload["recommendations"])
    if options.restore_actions:
        current_payload["actions"] = snapshot.get("actions", current_payload["actions"])
    if options.restore_kpi_definitions:
        current_payload["kpi_definitions"] = snapshot.get("kpi_definitions", current_payload["kpi_definitions"])
    if options.restore_narratives:
        current_payload["narratives"] = snapshot.get("narratives", current_payload["narratives"])

    refreshed_context = await generate_ai_context(JiraComplianceReport(**current_payload))
    current_payload["ai_context"] = refreshed_context.model_dump()

    rolled_back_report = await save_report_snapshot(current_payload)
    summary = build_summary(rolled_back_report)

    rollback_history = {
        "history_id": str(uuid.uuid4()),
        "preview_id": history_doc.get("preview_id", "rollback"),
        "uploaded_filename": f"ROLLBACK::{history_doc.get('uploaded_filename', 'snapshot')}",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "period": rolled_back_report.period,
        "executive_score": rolled_back_report.executive_score,
        "risk_level": rolled_back_report.risk_level,
        "red_controls": summary.red_controls,
        "report_snapshot": rolled_back_report.model_dump(),
    }
    await history_collection.insert_one(rollback_history.copy())
    await trim_history_to_limit(limit=10)

    return rolled_back_report


@api_router.get("/report/upload-history", response_model=List[UploadHistoryItem])
async def get_upload_history():
    history_items = await history_collection.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(10)
    return [UploadHistoryItem(**history_item) for history_item in history_items]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[origin.strip() for origin in cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()