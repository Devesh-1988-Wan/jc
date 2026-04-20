from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# =========================
# CORS
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
    "preview": None,
    "actions": [
        {"id": 1, "name": "Improve SLA", "status": "Open"},
        {"id": 2, "name": "Reduce MTTR", "status": "In Progress"},
    ]
}

# =========================
# HELPER (AI / FALLBACK)
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

    text = ""

    # ✅ HANDLE PDF PROPERLY
    if file.filename.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""

    else:
        # fallback for txt
        text = content.decode("utf-8", errors="ignore")

    if not text.strip():
        return {"error": "Could not extract text from file"}

    DATA_STORE["report"] = text
    DATA_STORE["summary"] = generate_summary(text)

    return {
        "message": "Report uploaded successfully",
        "chars_extracted": len(text)
    }

# =========================
# FETCH REPORT
# =========================
@app.get("/report")
def get_report():
    if not DATA_STORE["report"]:
        return {"error": "No report uploaded"}
    return {"report": DATA_STORE["report"]}

# =========================
# FETCH SUMMARY (FIX ADDED)
# =========================
@app.get("/report/summary")
def get_summary():
    if not DATA_STORE["summary"]:
        return {"error": "No summary available"}
    return {"summary": DATA_STORE["summary"]}

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
# APPLY PREVIEW (NEW)
# =========================
@app.post("/report/apply-preview")
def apply_preview():
    if not DATA_STORE["preview"]:
        return {"error": "No preview available"}

    # In real case → persist to DB
    return {
        "message": "Preview applied successfully",
        "data": DATA_STORE["preview"]
    }

# =========================
# FETCH ACTIONS (FIX PATH)
# =========================
@app.get("/actions")
def get_actions():
    return {"actions": DATA_STORE["actions"]}

# =========================
# PATCH ACTION STATUS (FIX)
# =========================
@app.patch("/actions/{action_id}")
def update_action(action_id: int, data: dict):
    for action in DATA_STORE["actions"]:
        if action["id"] == action_id:
            action["status"] = data.get("status", action["status"])
            return {"message": "Updated", "action": action}

    return {"error": "Action not found"}

# =========================
# RUN
# =========================
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)