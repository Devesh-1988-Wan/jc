from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import json
import tempfile
import os
import requests

app = FastAPI()

# ---------------------------
# CONFIG
# ---------------------------
USE_AI = True  # 🔥 Toggle AI ON/OFF

# ---------------------------
# CORS (DEV MODE)
# ---------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# HEALTH CHECK
# ---------------------------
@app.get("/")
def health():
    return {"status": "Backend running"}

# ---------------------------
# PDF PARSER (FIXED)
# ---------------------------
def parse_pdf(file_path):
    data = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                lines = text.split("\n")

                for line in lines:
                    if "AUD-" in line:
                        parts = line.split()

                        try:
                            # ✅ Extract correct AUD ID
                            audit_id = next(p for p in parts if p.startswith("AUD-"))

                            status = parts[-2]
                            value = int(parts[-1].replace("%", ""))

                            name_parts = [p for p in parts if p != audit_id][:-2]
                            name = " ".join(name_parts)

                            data.append({
                                "id": audit_id,
                                "name": name,
                                "status": status,
                                "value": value
                            })
                        except:
                            continue

    except Exception as e:
        print("PDF parsing error:", e)

    return data

# ---------------------------
# AI GENERATION (OLLAMA API)
# ---------------------------
def generate_ai_report(data):
    try:
        prompt = f"""
You are a senior Agile Transformation Consultant.

Analyze the following Jira Compliance Audit data and generate a leadership report.

DATA:
{json.dumps(data, indent=2)}

OUTPUT FORMAT:
1. Executive Summary
2. Key Risk Areas
3. Operational Insights
4. Impact on Delivery
5. Recommendations
6. Maturity Score
"""

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            },
            timeout=60
        )

        result = response.json()
        return result.get("response", "No AI response")

    except Exception as e:
        print("AI error:", e)
        return "AI generation failed (Ollama API issue)"

# ---------------------------
# FALLBACK REPORT (NO AI)
# ---------------------------
def generate_fallback_report(data):
    red = [d for d in data if d["status"] == "RED"]
    amber = [d for d in data if d["status"] == "AMBER"]
    green = [d for d in data if d["status"] == "GREEN"]

    score = (len(green) + 0.5 * len(amber)) / len(data)

    return f"""
EXECUTIVE SUMMARY
Compliance Score: {round(score * 100)}%

KEY RISKS
- {len(red)} RED issues
- Major breakdown in SLA and parent linkage

TOP ISSUES
{chr(10).join([f"- {r['name']} ({r['value']}%)" for r in red[:5]])}

INSIGHTS
- Weak governance controls
- High SLA breach rate
- Missing RCA practices

RECOMMENDATIONS
1. Enforce parent linkage
2. Mandate root cause field
3. Introduce SLA dashboards

MATURITY
Level 2 (Emerging)
"""

# ---------------------------
# UPLOAD API
# ---------------------------
@app.post("/upload")
@app.post("/upload/")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        if not file:
            return {"error": "No file uploaded"}

        if not file.filename.endswith(".pdf"):
            return {"error": "Only PDF files allowed"}

        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        parsed_data = parse_pdf(tmp_path)

        print("Parsed Data:", parsed_data)

        # 🔥 AI or fallback
        if USE_AI:
            report = generate_ai_report(parsed_data)
            mode = "AI"
        else:
            report = generate_fallback_report(parsed_data)
            mode = "RULE_BASED"

        os.remove(tmp_path)

        return {
            "data": parsed_data,
            "report": report,
            "mode": mode
        }

    except Exception as e:
        print("UPLOAD ERROR:", e)
        return {
            "error": str(e),
            "report": "Upload failed"
        }

# ---------------------------
# SUMMARY API
# ---------------------------
@app.get("/report/summary")
def get_summary():
    return {
        "summary": {
            "complianceScore": 62,
            "red": 8,
            "amber": 3,
            "green": 6,
            "insight": "Compliance is weak with major gaps in parent linkage and SLA adherence"
        }
    }

# ---------------------------
# FULL REPORT
# ---------------------------
@app.get("/report")
def get_report():
    return {
        "report": "Upload a PDF to generate a leadership report."
    }

# ---------------------------
# ACTIONS
# ---------------------------
@app.get("/report/actions")
def get_actions():
    return {
        "actions": [
            {"id": 1, "title": "Fix parent linkage", "status": "OPEN"},
            {"id": 2, "title": "Enforce SLA compliance", "status": "OPEN"},
            {"id": 3, "title": "Add root cause validation", "status": "IN_PROGRESS"}
        ]
    }

# ---------------------------
# UPDATE ACTION
# ---------------------------
@app.patch("/report/actions/{action_id}")
def update_action(action_id: int, payload: dict):
    return {
        "id": action_id,
        "status": payload.get("status", "UNKNOWN"),
        "message": "Updated successfully"
    }

# ---------------------------
# WIDGET CONFIG
# ---------------------------
@app.get("/report/widgets")
def get_widgets():
    return {
        "widgets": [
            {"id": "summary", "visible": True},
            {"id": "actions", "visible": True},
            {"id": "kpi", "visible": True}
        ]
    }

@app.put("/report/widgets")
def update_widgets(payload: dict):
    return {
        "message": "Widgets updated",
        "widgets": payload.get("widgets", [])
    }