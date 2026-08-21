import os

import psycopg
from psycopg.rows import dict_row


def get_connection():
    """Open a PostgreSQL connection that returns rows as dictionaries."""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    return psycopg.connect(database_url, row_factory=dict_row)

