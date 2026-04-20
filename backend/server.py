from typing import Dict, List, Optional, Any
import os

from fastapi import FastAPI, UploadFile, File, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configuration via environment variables
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS")  # comma-separated list
if ALLOWED_ORIGINS:
    allow_origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
else:
    # Default for local dev (adjust as needed)
    allow_origins = ["http://localhost:5173", "http://localhost:3000"]

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", 5 * 1024 * 1024))  # 5 MB default
ENABLE_DEBUG_ENDPOINT = os.getenv("ENABLE_DEBUG_ENDPOINT", "false").lower() in ("1", "true", "yes")

app = FastAPI()

# ==============================
# CORS (configurable via ALLOWED_ORIGINS)
# ==============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# Pydantic models
# ==============================
class Action(BaseModel):
    id: int
    name: str
    status: str

class ActionUpdate(BaseModel):
    status: str

class WidgetsUpdate(BaseModel):
    widgets: List[Dict[str, Any]] = []

# ==============================
# IN-MEMORY STORAGE (Replace with DB later)
# ==============================
store: Dict[str, Any] = {
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
# UPLOAD REPORT (streamed with size limit and basic MIME check)
# ==============================
@app.post("/report/upload")
async def upload_report(file: UploadFile = File(...)):
    # Basic validation of uploaded file type (optional)
    content_type = file.content_type or ""
    # Example: allow PDFs and plain text (adjust as needed)
    allowed_prefixes = ("application/pdf", "text/", "application/octet-stream")
    if not any(content_type.startswith(p) for p in allowed_prefixes):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            detail=f"Unsupported file type: {content_type}")

    # Stream read with size limit to avoid reading whole file into memory uncontrolled
    total_read = 0
    chunks = []
    chunk_size = 1024 * 256  # 256KB

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail=f"Upload exceeds maximum size of {MAX_UPLOAD_SIZE} bytes")
        chunks.append(chunk)

    content = b"".join(chunks)
    store["file"] = content

    # Reset downstream data
    store["preview"] = None
    store["report"] = None

    return {"message": "File uploaded successfully", "size_bytes": len(content)}


# ==============================
# GENERATE PREVIEW
# ==============================
@app.post("/report/preview")
async def generate_preview():
    if not store.get("file"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded")

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
    preview = store.get("preview")
    if not preview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not generated")
    return preview["summary"]


# ==============================
# FULL REPORT (Slide Brief)
# ==============================
@app.get("/report")
async def get_full_report():
    preview = store.get("preview")
    if not preview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not generated")

    # Build report dynamically from preview (example)
    report = {
        "title": "Leadership Compliance Report",
        "highlights": preview.get("insights", []),
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


@app.patch("/report/actions/{action_id}")
async def update_action(action_id: int, body: ActionUpdate):
    for idx, action in enumerate(store["actions"]):
        if action["id"] == action_id:
            store["actions"][idx]["status"] = body.status
            return store["actions"][idx]

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")


# ==============================
# WIDGET CONFIG
# ==============================
@app.get("/report/widgets")
async def get_widgets():
    return {"widgets": store["widgets"]}


@app.put("/report/widgets")
async def update_widgets(body: WidgetsUpdate = Body(...)):
    store["widgets"] = body.widgets
    return {
        "message": "Widgets updated successfully",
        "widgets": body.widgets
    }


# ==============================
# DEBUG ENDPOINT (guarded by env var)
# ==============================
@app.get("/debug/store")
async def debug_store():
    if not ENABLE_DEBUG_ENDPOINT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    # In debug mode we still avoid returning raw binary data
    safe_store = dict(store)
    if safe_store.get("file"):
        safe_store["file"] = f"<{len(safe_store['file'])} bytes>"
    return safe_store