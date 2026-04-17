"""Regression tests for AI metric refresh + preview/apply persistence workflows."""

import os
import uuid

import pytest
import requests
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
    session.headers.update({"Content-Type": "application/json"})
    return session


def _build_upload_text(tag: str) -> str:
    return (
        f"Executive Summary AI-METRIC-{tag} KPIs\n"
        "last 30 days\n"
        "AUD-01: Bugs without bug owner - 11% (AMBER)\n"
        "AUD-04: Tasks/sub-tasks with missing parent links - 62% (RED)\n"
        "AUD-13: Priority 1 tickets not resolved - 44% (RED)\n"
    )


def _upload_preview_standard(api_client: requests.Session, api_base_url: str, filename: str, text: str) -> dict:
    response = api_client.post(
        f"{api_base_url}/api/report/upload-preview",
        files={"file": (filename, text.encode("utf-8"), "text/plain")},
        timeout=45,
    )
    assert response.status_code == 200
    return response.json()


# Module: upload-preview generates AI context and supports multipart body fallback parsing
def test_upload_preview_generates_ai_context_and_accepts_multipart_with_json_header(
    api_client: requests.Session, api_base_url: str
) -> None:
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    filename = f"multipart-fallback-{uuid.uuid4().hex}.txt"
    payload_text = _build_upload_text("FALLBACK")

    multipart_body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        "Content-Type: text/plain\r\n\r\n"
        f"{payload_text}\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")

    response = api_client.post(
        f"{api_base_url}/api/report/upload-preview",
        data=multipart_body,
        headers={"Content-Type": "application/json"},
        timeout=45,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["uploaded_filename"] == filename
    assert isinstance(data["preview_id"], str) and len(data["preview_id"]) > 0
    assert isinstance(data["report"]["ai_context"], dict)
    assert isinstance(data["report"]["ai_context"]["executive_narrative"], str)
    assert isinstance(data["report"]["ai_context"]["leadership_talking_points"], list)
    assert len(data["report"]["ai_context"]["leadership_talking_points"]) >= 1


# Module: ai-metrics refresh endpoint updates preview metric package for graph-driven fields
def test_ai_metrics_refresh_endpoint_returns_metric_risk_recommendation_pack(
    api_client: requests.Session, api_base_url: str
) -> None:
    tag = uuid.uuid4().hex[:8]
    preview = _upload_preview_standard(
        api_client,
        api_base_url,
        f"ai-refresh-{tag}.txt",
        _build_upload_text(tag),
    )

    refresh_response = api_client.post(
        f"{api_base_url}/api/report/previews/{preview['preview_id']}/ai-metrics",
        timeout=45,
    )
    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()

    assert refreshed["preview_id"] == preview["preview_id"]
    assert isinstance(refreshed["report"]["metrics"], list) and len(refreshed["report"]["metrics"]) >= 1
    assert isinstance(refreshed["report"]["top_risks"], list) and len(refreshed["report"]["top_risks"]) >= 1
    assert isinstance(refreshed["report"]["recommendations"], list) and len(refreshed["report"]["recommendations"]) >= 1
    assert isinstance(refreshed["report"]["kpi_definitions"], list)
    assert len(refreshed["report"]["kpi_definitions"]) == len(refreshed["report"]["metrics"])
    assert isinstance(refreshed["report"]["ai_context"], dict)


# Module: apply-preview persists AI-refreshed preview state into active report
def test_apply_preview_persists_ai_refreshed_metrics_and_ai_context(
    api_client: requests.Session, api_base_url: str
) -> None:
    tag = uuid.uuid4().hex[:8]
    preview = _upload_preview_standard(
        api_client,
        api_base_url,
        f"ai-apply-refresh-{tag}.txt",
        _build_upload_text(tag),
    )

    refresh_response = api_client.post(
        f"{api_base_url}/api/report/previews/{preview['preview_id']}/ai-metrics",
        timeout=45,
    )
    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()

    apply_response = api_client.post(
        f"{api_base_url}/api/report/apply-preview/{preview['preview_id']}",
        timeout=45,
    )
    assert apply_response.status_code == 200
    applied = apply_response.json()

    get_report_response = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert get_report_response.status_code == 200
    persisted = get_report_response.json()

    assert persisted["metrics"] == applied["metrics"]
    assert persisted["metrics"] == refreshed["report"]["metrics"]
    assert persisted["top_risks"] == refreshed["report"]["top_risks"]
    assert persisted["recommendations"] == refreshed["report"]["recommendations"]
    assert persisted["ai_context"] == applied["ai_context"]
    assert isinstance(persisted["ai_context"]["leadership_talking_points"], list)
    assert len(persisted["ai_context"]["leadership_talking_points"]) >= 1
