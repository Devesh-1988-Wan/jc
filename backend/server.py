from datetime import datetime, timezone
import logging
import os
from pathlib import Path
from typing import List, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
cors_origins = os.environ["CORS_ORIGINS"]

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
report_collection = db.jira_compliance_reports

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
    }


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
        return JiraComplianceReport(**doc)

    seed_doc = build_seed_report()
    await report_collection.insert_one(seed_doc.copy())
    return JiraComplianceReport(**seed_doc)


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