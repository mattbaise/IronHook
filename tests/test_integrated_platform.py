from pathlib import Path

import pytest

from app import create_app
from routes import operator_worker_id
from security_operations import _deterministic_roll, _risk_score


ROOT = Path(__file__).resolve().parents[1]


def test_risk_scoring_is_weighted_and_transparent():
    score, factors = _risk_score({"country_risk": 100, "route_risk": 80, "shipper_risk": 50, "anomaly_risk": 40})
    assert score == 70
    assert {item["factor"] for item in factors} == {"country", "route", "shipper", "anomaly"}


def test_risk_scoring_rejects_non_numeric_values():
    with pytest.raises(ValueError):
        _risk_score({"country_risk": "high"})


def test_random_selection_roll_is_repeatable():
    assert _deterministic_roll("MSCU1234567", "demo") == _deterministic_roll("MSCU1234567", "demo")


def test_operator_identity_prevents_cross_worker_access(monkeypatch):
    monkeypatch.setattr("routes.current_user", lambda: {"role_code": "OPERATOR", "worker_id": 7})
    assert operator_worker_id(7) == 7
    with pytest.raises(PermissionError):
        operator_worker_id(8)


def test_configurable_yard_is_wired_into_yard_page():
    page = (ROOT / "templates/demo/yard_map.html").read_text()
    assert "configYardCanvas" in page
    assert "configurable_yard.js" in page
    assert "configurable_yard.css" in page


def test_vessel_assets_are_not_coupled_to_configurable_yard():
    for path in (ROOT / "templates/demo/vessel_operations.html", ROOT / "static/demo/vessel_operations.js"):
        assert "configurable_yard" not in path.read_text()


def test_migration_defines_required_integrated_records():
    migration = (ROOT / "migrations/002_integrated_platform.sql").read_text()
    for table in ("terminal_yard_block", "worker_document", "worker_schedule", "cargo_inspection_event"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in migration


def test_operational_api_requires_authentication():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/api/containers")
    assert response.status_code == 401
    assert response.get_json() == {"error": "Authentication required"}


def test_cross_origin_write_is_denied_before_database_access():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "bad"},
            headers={"Origin": "https://attacker.example"},
        )
    assert response.status_code == 403
    assert response.get_json() == {"error": "Cross-origin request denied"}
