import db


def test_database_module_loads_dotenv_before_connections(monkeypatch, tmp_path):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    env_path = tmp_path / ".env"
    env_path.write_text(
        "DATABASE_URL=postgresql://example.test/ironhook\n",
        encoding="utf-8",
    )

    db.load_environment(env_path)

    assert db.os.getenv("DATABASE_URL") == "postgresql://example.test/ironhook"
