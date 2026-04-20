from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import os

app = FastAPI()

# =========================
# CORS FIX
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_STORE = {
    "report": None,
    "summary": None,
    "preview": None
}

# =========================
# HELPER (OLLAMA OPTIONAL)
# =========================
def generate_summary(text):
    try:
        import requests
        res = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": f"Summarize this report:\n{text}",
                "stream": False
            }
        )
        return res.json()["response"]
    except:
        return f"Basic Summary:\n{text[:200]}"


# =========================
# UPLOAD REPORT
# =========================
@app.post("/report/upload")
async def upload_report(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    DATA_STORE["report"] = text
    DATA_STORE["summary"] = generate_summary(text)

    return {"message": "Report uploaded successfully"}

# =========================
# FETCH RAW REPORT
# =========================
@app.get("/report")
def get_report():
    if not DATA_STORE["report"]:
        return {"error": "No report uploaded"}
    
    return {"report": DATA_STORE["report"]}

# =========================
# GENERATE PREVIEW
# =========================
@app.post("/report/preview")
def generate_preview():
    if not DATA_STORE["summary"]:
        return {"error": "No summary available"}

    preview = {
        "title": "Executive Summary",
        "content": DATA_STORE["summary"]
    }

    DATA_STORE["preview"] = preview
    return preview
# =========================
# FETCH ACTIONS (KPI PAGE)
# =========================
@app.get("/report/actions")
def get_actions():
    return {
        "actions": [
            {"id": 1, "name": "Improve SLA", "status": "Open"},
            {"id": 2, "name": "Reduce MTTR", "status": "In Progress"},
        ]
    }


# =========================
# UPDATE WIDGETS
# =========================
@app.post("/report/widgets")
def update_widgets(data: dict):
    return {
        "message": "Widgets updated",
        "widgets": data
    }

# =========================
# PATCH STATUS (FIXED)
# =========================
@app.patch("/report/status")
def patch_status(data: dict):
    return {"message": "Status updated", "data": data}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
