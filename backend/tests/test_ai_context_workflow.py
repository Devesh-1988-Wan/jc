"""Regression tests for AI context generation and persistence across report workflows."""

import os
from datetime import datetime

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


def _upload_preview(api_client: requests.Session, api_base_url: str, name: str, text: str) -> dict:
    response = api_client.post(
        f"{api_base_url}/api/report/upload-preview",
        files={"file": (name, text.encode("utf-8"), "text/plain")},
        timeout=45,
    )
    assert response.status_code == 200
    return response.json()


def _apply_preview(api_client: requests.Session, api_base_url: str, preview_id: str) -> dict:
    response = api_client.post(f"{api_base_url}/api/report/apply-preview/{preview_id}", timeout=45)
    assert response.status_code == 200
    return response.json()


def _assert_ai_context_shape(ai_context: dict) -> None:
    assert isinstance(ai_context, dict)
    assert isinstance(ai_context.get("executive_narrative"), str)
    assert isinstance(ai_context.get("risk_story"), str)
    assert isinstance(ai_context.get("action_rationale"), str)
    assert isinstance(ai_context.get("leadership_talking_points"), list)
    assert len(ai_context["leadership_talking_points"]) >= 1


# Module: upload-preview should auto-generate AI context pack in preview payload
def test_upload_preview_auto_generates_ai_context_pack(api_client: requests.Session, api_base_url: str) -> None:
    tag = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    preview = _upload_preview(
        api_client,
        api_base_url,
        f"ai-context-preview-{tag}.txt",
        (
            f"Executive Summary AI-PREVIEW-{tag} KPIs\n"
            "last 30 days\n"
            "AUD-01: Bugs without bug owner - 11% (AMBER)\n"
            "AUD-13: Priority 1 tickets not resolved - 44% (RED)\n"
        ),
    )

    _assert_ai_context_shape(preview["report"]["ai_context"])


# Module: apply-preview should persist AI context into active report snapshot
def test_apply_preview_persists_ai_context_to_active_report(api_client: requests.Session, api_base_url: str) -> None:
    tag = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    preview = _upload_preview(
        api_client,
        api_base_url,
        f"ai-context-apply-{tag}.txt",
        (
            f"Executive Summary AI-APPLY-{tag} KPIs\n"
            "last 30 days\n"
            "AUD-04: Tasks/sub-tasks with missing parent links - 62% (RED)\n"
            "AUD-10: Root cause missing - 46% (RED)\n"
        ),
    )
    applied = _apply_preview(api_client, api_base_url, preview["preview_id"])

    get_report = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert get_report.status_code == 200
    report = get_report.json()

    assert report["key_message"] == applied["key_message"]
    assert report["ai_context"] == applied["ai_context"]
    _assert_ai_context_shape(report["ai_context"])


# Module: get_report should return ai_context for current report payload
def test_get_report_always_returns_ai_context(api_client: requests.Session, api_base_url: str) -> None:
    response = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert response.status_code == 200
    data = response.json()

    assert "ai_context" in data
    _assert_ai_context_shape(data["ai_context"])


# Module: rollback flow should keep ai_context available after restoring selected sections
def test_rollback_flow_returns_report_with_ai_context(api_client: requests.Session, api_base_url: str) -> None:
    tag_a = datetime.utcnow().strftime("A%Y%m%d%H%M%S")
    tag_b = datetime.utcnow().strftime("B%Y%m%d%H%M%S")

    preview_a = _upload_preview(
        api_client,
        api_base_url,
        f"ai-rollback-a-{tag_a}.txt",
        (
            f"Executive Summary ALPHA-{tag_a} KPIs\n"
            "last 30 days\n"
            "AUD-01: Bugs without bug owner - 11% (AMBER)\n"
            "AUD-13: Priority 1 tickets not resolved - 44% (RED)\n"
        ),
    )
    _apply_preview(api_client, api_base_url, preview_a["preview_id"])

    preview_b = _upload_preview(
        api_client,
        api_base_url,
        f"ai-rollback-b-{tag_b}.txt",
        (
            f"Executive Summary BRAVO-{tag_b} KPIs\n"
            "last 30 days\n"
            "AUD-01: Bugs without bug owner - 2% (GREEN)\n"
            "AUD-13: Priority 1 tickets not resolved - 12% (AMBER)\n"
        ),
    )
    _apply_preview(api_client, api_base_url, preview_b["preview_id"])

    history_response = api_client.get(f"{api_base_url}/api/report/upload-history", timeout=30)
    assert history_response.status_code == 200
    history = history_response.json()
    source_item = next((item for item in history if item["preview_id"] == preview_a["preview_id"]), None)
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
        timeout=45,
    )
    assert rollback_response.status_code == 200
    rolled_back = rollback_response.json()

    assert f"ALPHA-{tag_a}" in rolled_back["key_message"]
    _assert_ai_context_shape(rolled_back["ai_context"])


# Module: widget edits should regenerate and persist ai_context in report
def test_widgets_patch_keeps_ai_context_persisted(api_client: requests.Session, api_base_url: str) -> None:
    baseline_response = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert baseline_response.status_code == 200
    baseline = baseline_response.json()

    patch_response = api_client.patch(
        f"{api_base_url}/api/report/widgets",
        json={
            "period": "Current Quarter",
            "executive_score": 77,
            "risk_level": "Medium",
            "key_message": "Widget update for AI context persistence test",
        },
        timeout=45,
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()
    _assert_ai_context_shape(patched["ai_context"])

    verify_response = api_client.get(f"{api_base_url}/api/report", timeout=30)
    assert verify_response.status_code == 200
    persisted = verify_response.json()
    assert persisted["key_message"] == "Widget update for AI context persistence test"
    _assert_ai_context_shape(persisted["ai_context"])

    restore_response = api_client.patch(f"{api_base_url}/api/report/widgets", json=baseline, timeout=45)
    assert restore_response.status_code == 200