"""Regression tests for upload diff-era enhancements and widget editing APIs."""

import io
import os
from datetime import datetime

import pytest
import requests
from docx import Document
from dotenv import load_dotenv
from PIL import Image, ImageDraw


load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


@pytest.fixture(scope="session")
def api_base_url() -> str:
    if not BASE_URL:
        pytest.fail("REACT_APP_BACKEND_URL is not set")
    return BASE_URL.rstrip("/")


@pytest.fixture()
def api_client() -> requests.Session:
    return requests.Session()


def _docx_bytes(lines: list[str]) -> bytes:
    doc = Document()
    for line in lines:
        doc.add_paragraph(line)
    payload = io.BytesIO()
    doc.save(payload)
    return payload.getvalue()


def _pdf_bytes() -> bytes:
    return b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 290 >>
stream
BT
/F1 12 Tf
72 730 Td
(Executive Summary PDF parser validation KPIs) Tj
0 -18 Td
(last 30 days) Tj
0 -18 Td
(AUD-01: Bugs without bug owner - 11% \(AMBER\)) Tj
0 -18 Td
(AUD-04: Tasks/sub-tasks with missing parent links - 62% \(RED\)) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000063 00000 n
0000000120 00000 n
0000000246 00000 n
0000000316 00000 n
trailer
<< /Root 1 0 R /Size 6 >>
startxref
684
%%EOF"""


def _image_bytes(image_format: str, text: str) -> bytes:
    image = Image.new("RGB", (1200, 500), color=(255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.text((30, 30), text, fill=(0, 0, 0))
    payload = io.BytesIO()
    image.save(payload, format=image_format)
    return payload.getvalue()


def _preview_payload(tag: str) -> str:
    return (
        f"Executive Summary {tag} KPIs\n"
        "last 30 days\n"
        "AUD-01: Bugs without bug owner - 11% (AMBER)\n"
        "AUD-13: Priority 1 tickets not resolved - 44% (RED)\n"
    )


def _upload_preview(api_client: requests.Session, api_base_url: str, filename: str, content: bytes, mime: str) -> dict:
    response = api_client.post(
        f"{api_base_url}/api/report/upload-preview",
        files={"file": (filename, content, mime)},
        timeout=45,
    )
    assert response.status_code == 200
    return response.json()


# Module: upload-preview parser support for requested formats
@pytest.mark.parametrize(
    "filename,content,mime",
    [
        ("preview.txt", _preview_payload("TXT").encode("utf-8"), "text/plain"),
        ("preview.md", _preview_payload("MD").encode("utf-8"), "text/markdown"),
        (
            "preview.docx",
            _docx_bytes(
                [
                    "Executive Summary DOCX path KPIs",
                    "last 30 days",
                    "AUD-01: Bugs without bug owner - 11% (AMBER)",
                ]
            ),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        ("preview.pdf", _pdf_bytes(), "application/pdf"),
    ],
)
def test_upload_preview_supports_text_doc_formats(
    api_client: requests.Session,
    api_base_url: str,
    filename: str,
    content: bytes,
    mime: str,
) -> None:
    preview = _upload_preview(api_client, api_base_url, filename, content, mime)
    assert preview["uploaded_filename"] == filename
    assert isinstance(preview["preview_id"], str) and len(preview["preview_id"]) > 0
    assert isinstance(preview["report"]["metrics"], list) and len(preview["report"]["metrics"]) >= 1
    assert preview["report"]["report_id"] == "jira-leadership-30d"


# Module: upload-preview OCR support for JPG/PNG
@pytest.mark.parametrize(
    "filename,mime,image_format",
    [
        ("ocr-sample.png", "image/png", "PNG"),
        ("ocr-sample.jpg", "image/jpeg", "JPEG"),
    ],
)
def test_upload_preview_supports_image_ocr(
    api_client: requests.Session,
    api_base_url: str,
    filename: str,
    mime: str,
    image_format: str,
) -> None:
    text = "Executive Summary OCR KPIs\nlast 30 days\nAUD-01: Bugs without bug owner - 11% (AMBER)"
    image_bytes = _image_bytes(image_format=image_format, text=text)
    preview = _upload_preview(api_client, api_base_url, filename, image_bytes, mime)
    assert preview["uploaded_filename"] == filename
    assert isinstance(preview["report"]["metrics"], list)
    assert len(preview["report"]["metrics"]) >= 1


# Module: apply-preview writes current report and creates history snapshot
def test_apply_preview_updates_report_and_creates_history_entry(api_client: requests.Session, api_base_url: str) -> None:
    unique_tag = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    preview = _upload_preview(
        api_client,
        api_base_url,
        f"apply-enhancement-{unique_tag}.txt",
        _preview_payload(f"APPLY-{unique_tag}").encode("utf-8"),
        "text/plain",
    )

    apply_response = api_client.post(f"{api_base_url}/api/report/apply-preview/{preview['preview_id']}", timeout=30)
    assert apply_response.status_code == 200
    applied = apply_response.json()
    assert applied["report_id"] == "jira-leadership-30d"

    get_report = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert get_report.status_code == 200
    persisted = get_report.json()
    assert persisted["generated_at"] == applied["generated_at"]
    assert persisted["key_message"] == applied["key_message"]

    history_response = api_client.get(f"{api_base_url}/api/report/upload-history", timeout=30)
    assert history_response.status_code == 200
    history = history_response.json()
    assert len(history) >= 1
    assert any(item["preview_id"] == preview["preview_id"] for item in history)


# Module: rollback restores only selected sections based on options payload
def test_rollback_restores_selected_sections_only(api_client: requests.Session, api_base_url: str) -> None:
    tag_a = datetime.utcnow().strftime("A%Y%m%d%H%M%S")
    tag_b = datetime.utcnow().strftime("B%Y%m%d%H%M%S")

    preview_a = _upload_preview(
        api_client,
        api_base_url,
        f"rollback-a-{tag_a}.txt",
        (
            f"Executive Summary ALPHA-{tag_a} KPIs\n"
            "last 30 days\n"
            "AUD-01: Bugs without bug owner - 11% (AMBER)\n"
            "AUD-13: Priority 1 tickets not resolved - 44% (RED)\n"
        ).encode("utf-8"),
        "text/plain",
    )
    apply_a = api_client.post(f"{api_base_url}/api/report/apply-preview/{preview_a['preview_id']}", timeout=30)
    assert apply_a.status_code == 200

    preview_b = _upload_preview(
        api_client,
        api_base_url,
        f"rollback-b-{tag_b}.txt",
        (
            f"Executive Summary BRAVO-{tag_b} KPIs\n"
            "last 30 days\n"
            "AUD-01: Bugs without bug owner - 2% (GREEN)\n"
            "AUD-13: Priority 1 tickets not resolved - 12% (AMBER)\n"
        ).encode("utf-8"),
        "text/plain",
    )
    apply_b = api_client.post(f"{api_base_url}/api/report/apply-preview/{preview_b['preview_id']}", timeout=30)
    assert apply_b.status_code == 200
    current_after_b = apply_b.json()

    history_response = api_client.get(f"{api_base_url}/api/report/upload-history", timeout=30)
    assert history_response.status_code == 200
    history = history_response.json()
    source_item = next((row for row in history if row["preview_id"] == preview_a["preview_id"]), None)
    assert source_item is not None

    rollback_response = api_client.post(
        f"{api_base_url}/api/report/rollback/{source_item['history_id']}",
        json={
            "restore_summary": True,
            "restore_metrics": False,
            "restore_risks": False,
            "restore_recommendations": False,
            "restore_actions": False,
            "restore_kpi_definitions": False,
            "restore_narratives": False,
        },
        timeout=30,
    )
    assert rollback_response.status_code == 200
    rolled_back = rollback_response.json()

    # Summary should be restored from A, while metrics should remain from current B snapshot.
    assert f"ALPHA-{tag_a}" in rolled_back["key_message"]
    assert rolled_back["metrics"][0]["value"] == current_after_b["metrics"][0]["value"]


# Module: widget patch endpoint updates editable sections
def test_widgets_patch_updates_all_supported_sections(api_client: requests.Session, api_base_url: str) -> None:
    baseline_response = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert baseline_response.status_code == 200
    baseline = baseline_response.json()

    payload = {
        "period": "Current Quarter",
        "executive_score": 82,
        "risk_level": "Low",
        "key_message": "Updated via widget editor",
        "metrics": [
            {
                "metric_id": "AUD-01",
                "title": "Bugs without bug owner",
                "value": 1,
                "status": "GREEN",
                "category": "Workflow Hygiene",
                "insight": "Improved ownership coverage",
            }
        ],
        "top_risks": ["Not available"],
        "recommendations": ["Gate closure on mandatory work-log completion and assignee accountability."],
        "actions": [
            {
                "action_id": "ACT-01",
                "title": "Gate closure control",
                "owner": "Engineering Operations",
                "priority": "P1",
                "due_in_days": 7,
                "status": "In Progress",
                "expected_impact": "Reduce closure defects",
            }
        ],
        "kpi_definitions": [
            {
                "metric_id": "AUD-01",
                "definition": "Bugs without bug owner",
                "target": "GREEN <= 5%",
                "current_status": "GREEN",
            }
        ],
        "narratives": [
            {
                "what_happened": "Updated through editor",
                "why_it_matters": "Allows rapid adjustments",
                "recommendation": "Review weekly",
            }
        ],
    }

    patch_response = api_client.patch(f"{api_base_url}/api/report/widgets", json=payload, timeout=30)
    assert patch_response.status_code == 200
    patched = patch_response.json()
    assert patched["period"] == payload["period"]
    assert patched["executive_score"] == payload["executive_score"]
    assert patched["risk_level"] == payload["risk_level"]
    assert patched["metrics"][0]["value"] == 1
    assert patched["actions"][0]["title"] == "Gate closure control"
    assert patched["recommendations"][0] == payload["recommendations"][0]

    restore_response = api_client.patch(f"{api_base_url}/api/report/widgets", json=baseline, timeout=30)
    assert restore_response.status_code == 200
