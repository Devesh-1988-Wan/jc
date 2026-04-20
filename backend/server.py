from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ========================
# CORS (VERY IMPORTANT)
# ========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================
# MOCK DATA
# ========================
summary_data = {
    "health_score": 82,
    "risk_level": "Medium",
    "high_risk_areas": ["Cycle Time", "Reopen Rate"]
}

kpi_data = [
    {"metric_id": "AUD-01", "title": "Cycle Time", "value": 65, "status": "AMBER"},
    {"metric_id": "AUD-02", "title": "Lead Time", "value": 78, "status": "GREEN"},
]

actions = [
    {"id": 1, "title": "Fix cycle time", "status": "OPEN"},
    {"id": 2, "title": "Reduce reopen rate", "status": "OPEN"},
]

# ========================
# ROUTES
# ========================

@app.get("/report/summary")
def get_summary():
    return summary_data


@app.get("/report/kpis")
def get_kpis():
    return kpi_data


@app.post("/report/generate")
def generate_report():
    return {"message": "Report generated successfully"}


@app.patch("/actions/{action_id}")
def update_action(action_id: int, payload: dict):
    for action in actions:
        if action["id"] == action_id:
            action["status"] = payload.get("status", action["status"])
            return action

    return {"error": "Action not found"}