import argparse
from pathlib import Path

from db import get_connection


ROOT = Path(__file__).resolve().parent
MIGRATIONS = (
    (ROOT / "ironhook_container_schema_v1.sql", "SELECT to_regclass('public.terminal') IS NOT NULL"),
    (ROOT / "ironhook_demo_data_v1.sql", "SELECT EXISTS (SELECT 1 FROM terminal WHERE terminal_code='BLT-01')"),
    (ROOT / "ironhook_digital_credential_v1.sql", "SELECT to_regclass('public.worker_credential') IS NOT NULL"),
    (ROOT / "ironhook_assignment_credential_binding_v1.sql", "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credential_scan_event' AND column_name='consumed_at')"),
    (ROOT / "ironhook_identity_security_v1.sql", "SELECT to_regclass('public.app_user') IS NOT NULL"),
    (ROOT / "ironhook_worker_portal_v1.sql", "SELECT to_regclass('public.worker_pay_period') IS NOT NULL"),
    (ROOT / "ironhook_terminal_security_v1.sql", "SELECT to_regclass('public.terminal_configuration') IS NOT NULL"),
    (ROOT / "migrations/002_integrated_platform.sql", "SELECT to_regclass('public.terminal_yard_block') IS NOT NULL"),
)


def migrate():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """CREATE TABLE IF NOT EXISTS schema_migration (
                    migration_name TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )"""
            )
            for path, baseline_query in MIGRATIONS:
                cursor.execute(
                    "SELECT 1 FROM schema_migration WHERE migration_name = %s",
                    (path.name,),
                )
                if cursor.fetchone():
                    print(f"skip  {path.name}")
                    continue
                cursor.execute(baseline_query)
                baseline_row = cursor.fetchone()
                if next(iter(baseline_row.values())):
                    cursor.execute(
                        "INSERT INTO schema_migration (migration_name) VALUES (%s)",
                        (path.name,),
                    )
                    print(f"base  {path.name}")
                    continue
                cursor.execute(path.read_text(encoding="utf-8"))
                cursor.execute(
                    "INSERT INTO schema_migration (migration_name) VALUES (%s)",
                    (path.name,),
                )
                print(f"apply {path.name}")


def main():
    parser = argparse.ArgumentParser(description="Manage the IronHook database")
    parser.add_argument("command", choices=("migrate", "seed-demo"))
    args = parser.parse_args()
    if args.command == "migrate":
        migrate()
    elif args.command == "seed-demo":
        from scripts.seed_integrated_demo import seed
        seed()


if __name__ == "__main__":
    main()
