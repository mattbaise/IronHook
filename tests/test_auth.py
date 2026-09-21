from app import create_app


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


def test_logout_clears_session():
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
