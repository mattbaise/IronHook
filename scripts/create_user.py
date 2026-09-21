import argparse
import getpass

from werkzeug.security import generate_password_hash

from db import get_connection


ROLES = (
    "OPERATOR",
    "SUPERVISOR",
    "DISPATCHER",
    "SECURITY",
    "HR_PAYROLL",
    "ADMIN",
)


def main():
    parser = argparse.ArgumentParser(description="Create an IronHook application user")
    parser.add_argument("username")
    parser.add_argument("display_name")
    parser.add_argument("role", choices=ROLES)
    parser.add_argument("--worker-id", type=int)
    args = parser.parse_args()

    password = getpass.getpass("Password: ")
    confirmation = getpass.getpass("Confirm password: ")

    if password != confirmation:
        raise SystemExit("Passwords do not match")
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters")

    password_hash = generate_password_hash(password)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app_user (
                    worker_id,
                    username,
                    password_hash,
                    display_name,
                    role_code
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING user_id, username, role_code
                """,
                (
                    args.worker_id,
                    args.username.strip().lower(),
                    password_hash,
                    args.display_name.strip(),
                    args.role,
                ),
            )
            user = cursor.fetchone()

    print(f"Created {user['username']} ({user['role_code']}) as user {user['user_id']}")


if __name__ == "__main__":
    main()
