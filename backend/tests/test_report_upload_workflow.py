"""Regression tests for report upload preview/apply/history workflows."""

import io
import os
from datetime import datetime

import pytest
import requests
from docx import Document
from dotenv import load_dotenv


load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


@pytest.fixture(scope="session")
def api_base_url() -> str:
    if not BASE_URL:
        pytest.fail("REACT_APP_BACKEND_URL is not set")
    return BASE_URL.rstrip("/")


@pytest.fixture()
def api_client() -> requests.Session:
    session = requests.Session()
    return session


def _build_docx_bytes(lines: list[str]) -> bytes:
    doc = Document()
    for line in lines:
        doc.add_paragraph(line)

    payload = io.BytesIO()
    doc.save(payload)
    return payload.getvalue()


def _build_simple_pdf_with_text() -> bytes:
    # Module: static PDF fixture with extractable text for /upload-preview happy-path test
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
<< /Length 320 >>
stream
BT
/F1 12 Tf
72 730 Td
(Executive Summary This upload refreshes controls for last 30 days.) Tj
0 -18 Td
(AUD-01: Bugs without bug owner - 11% (AMBER)) Tj
0 -18 Td
(AUD-04: Tasks/sub-tasks with missing parent links - 62% (RED)) Tj
0 -18 Td
(AUD-06: Open sub-tasks with done parent - 0% (GREEN)) Tj
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
700
%%EOF"""


# Module: PDF upload-preview API acceptance + schema checks
def test_upload_preview_accepts_pdf_and_returns_expected_shape(api_client: requests.Session, api_base_url: str) -> None:
    files = {
        "file": ("upload-preview.pdf", _build_simple_pdf_with_text(), "application/pdf"),
    }
    response = api_client.post(f"{api_base_url}/api/report/upload-preview", files=files, timeout=30)
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["preview_id"], str) and len(data["preview_id"]) > 0
    assert data["uploaded_filename"] == "upload-preview.pdf"
    assert isinstance(data["report"], dict)
    assert data["report"]["report_id"] == "jira-leadership-30d"
    assert isinstance(data["missing_fields"], list)
    assert isinstance(data["warnings"], list)
    assert isinstance(data["report"]["metrics"], list) and len(data["report"]["metrics"]) >= 1


# Module: DOCX upload-preview API acceptance + parser behavior checks
def test_upload_preview_accepts_docx(api_client: requests.Session, api_base_url: str) -> None:
    docx_bytes = _build_docx_bytes(
        [
            "Executive Summary Dashboard parsed from DOCX upload.",
            "Last 30 days",
            "AUD-02: Tasks/sub-tasks with missing estimates - 0% (GREEN)",
            "AUD-10: Root cause missing - 46% (RED)",
        ]
    )

    files = {
        "file": ("preview.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    }
    response = api_client.post(f"{api_base_url}/api/report/upload-preview", files=files, timeout=30)
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["preview_id"], str) and len(data["preview_id"]) > 0
    assert data["uploaded_filename"] == "preview.docx"
    assert data["report"]["period"] in ["Last 30 Days", "Not available"]
    assert isinstance(data["report"]["executive_score"], int)
    assert data["report"]["risk_level"] in ["Low", "Medium", "High"]


# Module: unsupported extension and empty-file validation checks
def test_upload_preview_rejects_unsupported_file_type(api_client: requests.Session, api_base_url: str) -> None:
    files = {
        "file": ("bad.csv", b"AUD-01,sample", "text/csv"),
    }
    response = api_client.post(f"{api_base_url}/api/report/upload-preview", files=files, timeout=30)
    assert response.status_code == 400
    assert response.json()["detail"] == "Supported formats: PDF, DOCX, TXT, MD, JPG, JPEG, PNG"


def test_upload_preview_rejects_empty_file(api_client: requests.Session, api_base_url: str) -> None:
    files = {
        "file": ("empty.pdf", b"", "application/pdf"),
    }
    response = api_client.post(f"{api_base_url}/api/report/upload-preview", files=files, timeout=30)
    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is empty"


# Module: apply-preview persists report updates and creates upload history row
def test_apply_preview_updates_report_and_history(api_client: requests.Session, api_base_url: str) -> None:
    unique_tag = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    docx_bytes = _build_docx_bytes(
        [
            f"Executive Summary Uploaded summary tag {unique_tag}",
            "Last 30 days",
            "AUD-11: Development completion date compliance - 52% (RED)",
            "AUD-12: Done tickets mapped to fix version - 5% (GREEN)",
            "AUD-13: Priority 1 tickets not resolved - 44% (RED)",
        ]
    )

    preview_response = api_client.post(
        f"{api_base_url}/api/report/upload-preview",
        files={
            "file": (
                f"apply-check-{unique_tag}.docx",
                docx_bytes,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        timeout=30,
    )
    assert preview_response.status_code == 200

    preview_data = preview_response.json()
    preview_id = preview_data["preview_id"]

    apply_response = api_client.post(f"{api_base_url}/api/report/apply-preview/{preview_id}", timeout=30)
    assert apply_response.status_code == 200
    applied_report = apply_response.json()
    assert applied_report["report_id"] == "jira-leadership-30d"
    assert applied_report["generated_at"]

    report_response = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert report_response.status_code == 200
    report_data = report_response.json()
    assert report_data["generated_at"] == applied_report["generated_at"]
    assert report_data["period"] == applied_report["period"]
    assert report_data["executive_score"] == applied_report["executive_score"]

    history_response = api_client.get(f"{api_base_url}/api/report/upload-history", timeout=30)
    assert history_response.status_code == 200
    history = history_response.json()
    assert isinstance(history, list)
    assert len(history) >= 1
    assert history[0]["preview_id"] == preview_id


# Module: upload history cap enforcement (latest 10 only)
def test_upload_history_keeps_max_ten_records(api_client: requests.Session, api_base_url: str) -> None:
    created_preview_ids = []

    for idx in range(11):
        payload = _build_docx_bytes(
            [
                f"Executive Summary bulk history check run {idx}",
                "Last 30 days",
                f"AUD-0{(idx % 9) + 1}: Bulk metric line - {10 + idx}% (AMBER)",
            ]
        )

        preview_response = api_client.post(
            f"{api_base_url}/api/report/upload-preview",
            files={
                "file": (
                    f"history-run-{idx}.docx",
                    payload,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
            timeout=30,
        )
        assert preview_response.status_code == 200
        preview_id = preview_response.json()["preview_id"]
        created_preview_ids.append(preview_id)

        apply_response = api_client.post(f"{api_base_url}/api/report/apply-preview/{preview_id}", timeout=30)
        assert apply_response.status_code == 200

    history_response = api_client.get(f"{api_base_url}/api/report/upload-history", timeout=30)
    assert history_response.status_code == 200
    history = history_response.json()

    assert len(history) == 10
    history_preview_ids = [row["preview_id"] for row in history]
    assert created_preview_ids[-1] in history_preview_ids
    assert created_preview_ids[0] not in history_preview_ids
