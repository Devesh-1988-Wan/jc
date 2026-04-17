"""API regression tests for Jira leadership compliance report endpoints."""

import os
from typing import Dict, List

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


# Module: leadership report core endpoint contract
def test_get_report_seeded_payload(api_client: requests.Session, api_base_url: str) -> None:
    response = api_client.get(f"{api_base_url}/api/report", timeout=20)
    assert response.status_code == 200

    data = response.json()
    assert data["report_id"] == "jira-leadership-30d"
    assert isinstance(data["period"], str) and len(data["period"]) > 0
    assert isinstance(data["executive_score"], int) and 0 <= data["executive_score"] <= 100
    assert isinstance(data["metrics"], list) and len(data["metrics"]) >= 1
    assert isinstance(data["recommendations"], list) and len(data["recommendations"]) >= 1
    assert isinstance(data["actions"], list) and len(data["actions"]) >= 1
    assert isinstance(data["kpi_definitions"], list) and len(data["kpi_definitions"]) == len(data["metrics"])
    assert isinstance(data["narratives"], list) and len(data["narratives"]) >= 1


# Module: summary endpoint consistency with metrics control statuses
def test_get_report_summary_counts_match_report(api_client: requests.Session, api_base_url: str) -> None:
    report_response = api_client.get(f"{api_base_url}/api/report", timeout=20)
    summary_response = api_client.get(f"{api_base_url}/api/report/summary", timeout=20)
    assert report_response.status_code == 200
    assert summary_response.status_code == 200

    report_data = report_response.json()
    summary_data = summary_response.json()

    metrics: List[Dict] = report_data["metrics"]
    green_controls = len([metric for metric in metrics if metric["status"] == "GREEN"])
    amber_controls = len([metric for metric in metrics if metric["status"] == "AMBER"])
    red_controls = len([metric for metric in metrics if metric["status"] == "RED"])

    assert summary_data["period"] == report_data["period"]
    assert summary_data["executive_score"] == report_data["executive_score"]
    assert summary_data["total_controls"] == len(metrics)
    assert summary_data["green_controls"] == green_controls
    assert summary_data["amber_controls"] == amber_controls
    assert summary_data["red_controls"] == red_controls


# Module: action tracking list and expected payload shape
def test_get_report_actions_list(api_client: requests.Session, api_base_url: str) -> None:
    response = api_client.get(f"{api_base_url}/api/report/actions", timeout=20)
    assert response.status_code == 200

    actions = response.json()
    assert isinstance(actions, list)
    assert len(actions) >= 1

    action = actions[0]
    assert isinstance(action["action_id"], str)
    assert action["priority"] in ["P0", "P1", "P2"]
    assert action["status"] in ["Not Started", "In Progress", "Completed"]
    assert isinstance(action["due_in_days"], int)


# Module: action status update persistence (PATCH then GET verification)
def test_patch_action_status_updates_and_persists(api_client: requests.Session, api_base_url: str) -> None:
    actions_response = api_client.get(f"{api_base_url}/api/report/actions", timeout=20)
    assert actions_response.status_code == 200
    actions = actions_response.json()
    assert len(actions) > 0

    target_action = actions[0]
    action_id = target_action["action_id"]
    original_status = target_action["status"]
    new_status = "Completed" if original_status != "Completed" else "In Progress"

    update_response = api_client.patch(
        f"{api_base_url}/api/report/actions/{action_id}",
        json={"status": new_status},
        timeout=20,
    )
    assert update_response.status_code == 200
    updated_action = update_response.json()
    assert updated_action["action_id"] == action_id
    assert updated_action["status"] == new_status

    verify_response = api_client.get(f"{api_base_url}/api/report/actions", timeout=20)
    assert verify_response.status_code == 200
    verify_actions = verify_response.json()
    persisted_action = next(action for action in verify_actions if action["action_id"] == action_id)
    assert persisted_action["status"] == new_status

    revert_response = api_client.patch(
        f"{api_base_url}/api/report/actions/{action_id}",
        json={"status": original_status},
        timeout=20,
    )
    assert revert_response.status_code == 200
    assert revert_response.json()["status"] == original_status


# Module: invalid action update error handling
def test_patch_action_status_returns_404_for_unknown_action(api_client: requests.Session, api_base_url: str) -> None:
    response = api_client.patch(
        f"{api_base_url}/api/report/actions/ACT-UNKNOWN",
        json={"status": "Completed"},
        timeout=20,
    )
    assert response.status_code == 404
    error = response.json()
    assert error["detail"] == "Action item not found"


# Module: PATCH payload validation rules
def test_patch_action_status_rejects_invalid_status(api_client: requests.Session, api_base_url: str) -> None:
    actions_response = api_client.get(f"{api_base_url}/api/report/actions", timeout=20)
    assert actions_response.status_code == 200
    action_id = actions_response.json()[0]["action_id"]

    response = api_client.patch(
        f"{api_base_url}/api/report/actions/{action_id}",
        json={"status": "Done"},
        timeout=20,
    )
    assert response.status_code == 422
