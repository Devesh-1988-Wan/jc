from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List

app = FastAPI()

# ==============================
# CORS
# ==============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# IN-MEMORY STORAGE (Replace with DB later)
# ==============================
store = {
    "file": None,
    "preview": None,
    "report": None,
    "widgets": [],
    "actions": [
        {"id": 1, "name": "Fix Parent Links", "status": "OPEN"},
        {"id": 2, "name": "Improve SLA", "status": "OPEN"},
    ],
}

# ==============================
# HEALTH CHECK
# ==============================
@app.get("/health")
async def health():
    return {"status": "running"}

# ==============================
# UPLOAD REPORT
# ==============================
@app.post("/report/upload")
async def upload_report(file: UploadFile = File(...)):
    content = await file.read()
    store["file"] = content

    # Reset downstream data
    store["preview"] = None
    store["report"] = None

    return {"message": "File uploaded successfully"}

# ==============================
# GENERATE PREVIEW
# ==============================
@app.post("/report/preview")
async def generate_preview():
    if not store["file"]:
        return {"error": "No file uploaded"}

    # 👉 Replace this with real parsing later (PDF/Jira data)
    preview = {
        "summary": {
            "total_checks": 17,
            "red": 8,
            "amber": 3,
            "green": 6,
        },
        "insights": [
            "High parent linkage issues",
            "SLA breaches observed",
            "Estimation discipline is strong",
        ],
    }

    store["preview"] = preview
    return preview

# ==============================
# FETCH SUMMARY
# ==============================
@app.get("/report/summary")
async def get_summary():
    if not store["preview"]:
        return {"error": "Preview not generated"}

    return store["preview"]["summary"]

# ==============================
# FULL REPORT (Slide Brief)
# ==============================
@app.get("/report")
async def get_full_report():
    if not store["preview"]:
        return {"error": "Preview not generated"}

    # Build report dynamically from preview
    report = {
        "title": "Leadership Compliance Report",
        "highlights": store["preview"]["insights"],
        "risk_areas": [
            "Parent linkage",
            "Resolution SLA",
            "Dev completion compliance",
        ],
    }

    store["report"] = report
    return report

# ==============================
# ACTIONS
# ==============================
@app.get("/report/actions")
async def get_actions():
    return store["actions"]

@app.patch("/report/actions/{id}")
async def update_action(id: int, body: Dict):
    for action in store["actions"]:
        if action["id"] == id:
            action["status"] = body.get("status", action["status"])
            return action

    return {"error": "Action not found"}

# ==============================
# WIDGET CONFIG (NOW COMPLETE)
# ==============================
@app.get("/report/widgets")
async def get_widgets():
    return {"widgets": store["widgets"]}

@app.put("/report/widgets")
async def update_widgets(body: Dict):
    widgets = body.get("widgets", [])
    store["widgets"] = widgets

    return {
        "message": "Widgets updated successfully",
        "widgets": widgets
    }

# ==============================
# DEBUG ENDPOINT (VERY USEFUL)
# ==============================
@app.get("/debug/store")
async def debug_store():
    return store