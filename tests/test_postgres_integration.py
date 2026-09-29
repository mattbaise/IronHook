"""Opt-in full-stack tests.

Set TEST_DATABASE_URL to a dedicated, empty PostgreSQL database. These tests run
the real migration and demo seed before exercising Flask, sessions, RBAC and the
cargo-security transaction workflow.
"""

import os

import pytest


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is not configured for PostgreSQL integration tests",
)


@pytest.fixture(scope="module")
def integrated_app():
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL or ""
    os.environ["SECRET_KEY"] = "integration-test-secret-key"
    from manage import migrate
    from scripts.seed_integrated_demo import seed

    migrate()
    seed()
    from app import create_app

    app = create_app()
    app.config.update(TESTING=True)
    return app


def login(client, username):
    return client.post(
        "/api/auth/login",
        json={"username": username, "password": "IronHookDemo!2026"},
    )


def test_demo_login_and_rbac(integrated_app):
    with integrated_app.test_client() as client:
        response = login(client, "operator")
        assert response.status_code == 200
        assert client.get("/operator").status_code == 200
        assert client.get("/admin").status_code == 302


def test_admin_terminal_configuration_round_trip(integrated_app):
    with integrated_app.test_client() as client:
        assert login(client, "admin").status_code == 200
        terminals = client.get("/api/admin/terminals").get_json()["terminals"]
        terminal_id = terminals[0]["terminal_id"]
        response = client.get(f"/api/admin/terminals/{terminal_id}/configuration")
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["zones"]
        assert payload["blocks"]


def test_security_selection_places_and_clears_hold(integrated_app):
    with integrated_app.test_client() as client:
        assert login(client, "security").status_code == 200
        response = client.post(
            "/api/security/containers/2/assess",
            json={"country_risk": 100, "route_risk": 100, "shipper_risk": 100, "anomaly_risk": 100},
        )
        assert response.status_code == 200
        inspection = response.get_json()["inspection"]
        assert inspection
        inspection_id = inspection["inspection_selection_id"]
        started = client.post(
            f"/api/security/inspections/{inspection_id}/events",
            json={"event_type": "STARTED", "location_label": "Inspection Bay 1"},
        )
        assert started.status_code == 201
        cleared = client.post(
            f"/api/security/inspections/{inspection_id}/events",
            json={"event_type": "CLEARED", "notes": "Seal and manifest verified"},
        )
        assert cleared.status_code == 201
        detail = client.get(f"/api/security/inspections/{inspection_id}").get_json()
        assert detail["inspection"]["inspection_status"] == "CLEARED"
        assert len(detail["chain_of_custody"]) >= 3
