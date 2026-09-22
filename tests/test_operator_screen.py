from pathlib import Path

import app as app_module
import auth
import pytest
from app import create_app


def authenticate(monkeypatch, role="ADMIN", worker_id=1):
    identity = {"user_id": 1, "worker_id": worker_id, "username": "tester", "display_name": "Test User", "role_code": role, "employee_number": "MB1001", "job_classification": "Operator", "union_local_code": "LOCAL-000"}
    monkeypatch.setattr(auth, "current_user", lambda: identity)
    monkeypatch.setattr(app_module, "current_user", lambda: identity)


def test_protected_pages_redirect_to_login():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        operator = client.get("/operator")
        command = client.get("/")
    assert operator.status_code == 302
    assert command.status_code == 302
    assert "/login" in operator.headers["Location"]


def test_operator_screen_loads_for_operator(monkeypatch):
    authenticate(monkeypatch, "OPERATOR")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/operator")
    assert response.status_code == 200
    assert b"My IronHook" in response.data
    assert b"Hours & Work History" in response.data
    assert b"My Documents" in response.data
    assert b"Schedule & Gang" in response.data
    assert b'class="app-shell operator-shell"' in response.data
    assert b"integrated_shell.css" in response.data
    assert b'class="sidebar operator-sidebar"' in response.data
    assert b'id="worker-name">Loading' not in response.data
    assert b'href="#view-hours"' in response.data
    assert b"DIGITAL CASUAL CARD" in response.data
    assert b"/api/workers/1/credential/qr" in response.data
    assert b"Certification history" in response.data
    assert b"Signed off by" in response.data
    assert b"operator_headshot.svg" in response.data
    assert b"Tomorrow" in response.data
    assert b"TWIC Card" in response.data


def test_operator_replay_keeps_full_shift_workflow_on_one_page(monkeypatch):
    authenticate(monkeypatch, "OPERATOR")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/workday-replay")
    assert response.status_code == 200
    assert b'id="replayCamera"' in response.data
    assert b'id="replayCredentialPayload"' in response.data
    assert b'id="acceptDispatch"' in response.data
    assert b'id="authorizeEquipment"' in response.data
    assert b'id="confirmPickup"' in response.data
    assert b'id="confirmDelivery"' in response.data
    assert b'id="finishShift"' in response.data
    assert b"Open real camera scanner" not in response.data


@pytest.mark.parametrize(
    ("role", "expected_location"),
    [
        ("OPERATOR", "/operator"),
        ("SUPERVISOR", "/"),
        ("DISPATCHER", "/"),
        ("SECURITY", "/"),
        ("HR_PAYROLL", "/"),
        ("ADMIN", "/"),
    ],
)
def test_authenticated_roles_redirect_to_valid_home(monkeypatch, role, expected_location):
    authenticate(monkeypatch, role)
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/login")
    assert response.status_code == 302
    assert response.headers["Location"].endswith(expected_location)


def test_analytics_has_its_own_page(monkeypatch):
    authenticate(monkeypatch, "ADMIN")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/analytics")
    assert response.status_code == 200
    assert b"Terminal Analytics" in response.data
    assert b'href="/analytics" class="nav-item active"' in response.data
    assert b"analytics.js" in response.data


@pytest.mark.parametrize("role", ["OPERATOR", "HR_PAYROLL"])
def test_analytics_rejects_roles_without_operational_access(monkeypatch, role):
    authenticate(monkeypatch, role)
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/analytics")
    assert response.status_code == 302
    assert response.headers["Location"].endswith(auth.ROLE_HOME[role])


@pytest.mark.parametrize(
    "role",
    ["OPERATOR", "SUPERVISOR", "DISPATCHER", "SECURITY", "HR_PAYROLL", "ADMIN"],
)
def test_every_login_can_access_role_based_workday_replay(monkeypatch, role):
    authenticate(monkeypatch, role)
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/workday-replay")
    assert response.status_code == 200
    assert b"Replay Operations" in response.data
    assert f'data-role="{role}"'.encode() in response.data
    assert b"CHIQUITA EXPLORER" in response.data


def test_vessel_uses_updated_customer_facing_labels():
    vessel_page = Path(app_module.__file__).parent / "templates/demo/vessel_operations.html"
    page = vessel_page.read_text(encoding="utf-8")
    assert "CHIQUITA EXPLORER" in page
    assert "CRANE1" in page and "CRANE4" in page
    assert "IRONHOOK HORIZON" not in page
    assert "Start Simulation" not in page


def test_command_center_loads_integrated_navigation(monkeypatch):
    authenticate(monkeypatch, "ADMIN")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/")
    assert response.status_code == 200
    assert b"Vessel Operations" in response.data
    assert b"Yard Map" in response.data
    assert b"Cargo Security" in response.data
    assert b"Admin" in response.data


def test_command_center_is_a_separate_module_with_home_link(monkeypatch):
    authenticate(monkeypatch, "ADMIN")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/command-center")
    assert response.status_code == 200
    assert b"Command Center" in response.data
    assert b"Overview" in response.data
    assert b'class="app-shell"' in response.data
    assert b'class="sidebar"' in response.data
    assert b'href="/command-center" class="nav-item active"' in response.data
    assert b"integrated_shell.css" in response.data


def test_demo_pages_receive_completed_navigation(monkeypatch):
    authenticate(monkeypatch, "ADMIN")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/demo")
    assert response.status_code == 200
    assert b'/static/demo/navigation.js' in response.data


def test_admin_uses_guided_yard_builder(monkeypatch):
    authenticate(monkeypatch, "ADMIN")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/admin")
    assert response.status_code == 200
    assert b"Build the yard in three clear steps" in response.data
    assert b'admin-yard-preview' in response.data
    assert b'zone-x' in response.data
    assert b'block-rules' not in response.data


def test_security_uses_integrated_navigation(monkeypatch):
    authenticate(monkeypatch, "ADMIN")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/security")
    assert response.status_code == 200
    assert b"Cargo Security & Inspection" in response.data
    assert b'href="/"' in response.data
    assert b'href="/demo/credential-scan"' in response.data


def test_role_bound_pages_reject_wrong_role(monkeypatch):
    authenticate(monkeypatch, "OPERATOR")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        admin_response = client.get("/admin")
        security_response = client.get("/security")
    assert admin_response.status_code == 302
    assert security_response.status_code == 302
    assert admin_response.headers["Location"].endswith("/operator")


def test_security_headers_are_applied(monkeypatch):
    authenticate(monkeypatch, "ADMIN")
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert "default-src 'self'" in response.headers["Content-Security-Policy"]


def test_unknown_page_still_returns_json_404():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        response = client.get("/not-a-real-page")
    assert response.status_code == 404
    assert response.get_json() == {"error": "Route not found"}
