import auth
from app import create_app


class DummyConnection:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self):
        return self


def test_current_user_requires_authentication():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.get_json() == {"authenticated": False}


def test_login_requires_username_and_password():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        response = client.post("/api/auth/login", json={})

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Username and password are required"
    }


def test_logout_clears_session(monkeypatch):
    monkeypatch.setattr(auth, "get_connection", lambda: DummyConnection())
    monkeypatch.setattr(auth, "_record_auth_event", lambda *_args, **_kwargs: None)
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        with client.session_transaction() as session:
            session["user_id"] = 99
            session["role_code"] = "OPERATOR"

        response = client.post("/api/auth/logout")

        assert response.status_code == 200
        assert response.get_json() == {"authenticated": False}

        with client.session_transaction() as session:
            assert "user_id" not in session
            assert "role_code" not in session
