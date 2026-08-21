from app import create_app


def test_operator_screen_loads():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        response = client.get("/operator")

    assert response.status_code == 200
    assert b"IronHook Operator" in response.data
    assert b"My dispatch assignments" in response.data
    assert b"operator.css" in response.data
    assert b"operator.js" in response.data


def test_command_center_still_loads():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        response = client.get("/")

    assert response.status_code == 200
    assert b"Command Center" in response.data


def test_unknown_page_still_returns_json_404():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        response = client.get("/not-a-real-page")

    assert response.status_code == 404
    assert response.get_json() == {"error": "Route not found"}
