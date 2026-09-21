import app as app_module
import auth
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
    assert b"IronHook Operator" in response.data
    assert b"Hours & Work History" in response.data
    assert b"My Documents" in response.data
    assert b"Schedule & Gang" in response.data


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
    assert b"Operations Home" in response.data


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
