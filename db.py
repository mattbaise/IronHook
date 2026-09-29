import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row


def load_environment(path=None):
    """Load the project .env for the web app and standalone management scripts."""
    load_dotenv(path or Path(__file__).resolve().with_name(".env"))


load_environment()


def get_connection():
    """Open a PostgreSQL connection that returns rows as dictionaries."""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    return psycopg.connect(database_url, row_factory=dict_row)
