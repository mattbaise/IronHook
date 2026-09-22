from functools import wraps

from flask import Blueprint, current_app, jsonify, redirect, request, session, url_for
from psycopg.types.json import Jsonb
from werkzeug.security import check_password_hash

from db import get_connection


auth = Blueprint("auth", __name__)

ROLE_HOME = {
    "OPERATOR": "/operator",
    "SUPERVISOR": "/",
    "DISPATCHER": "/",
    "SECURITY": "/",
    "HR_PAYROLL": "/",
    "ADMIN": "/",
}

COMMAND_CENTER_ROLES = {
    "SUPERVISOR", "DISPATCHER", "SECURITY", "HR_PAYROLL", "ADMIN"
}


def _record_auth_event(cursor, event_type, outcome, username, user_id=None, details=None):
    cursor.execute(
        """INSERT INTO auth_security_event (
               user_id, username_attempted, event_type, outcome,
               ip_address, user_agent, details
           ) VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (
            user_id, username or None, event_type, outcome,
            request.remote_addr, request.user_agent.string[:500], Jsonb(details or {}),
        ),
    )


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.user_id, u.worker_id, u.username, u.display_name,
                       u.role_code, u.active, w.employee_number,
                       w.job_classification, w.union_local_code
                FROM app_user u
                LEFT JOIN worker w ON w.worker_id = u.worker_id
                WHERE u.user_id = %s
                """,
                (user_id,),
            )
            user = cursor.fetchone()

    if not user or not user["active"]:
        session.clear()
        return None
    return user


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("login_page", next=request.path))
        return view(*args, **kwargs)
    return wrapped


def roles_required(*allowed_roles):
    allowed = set(allowed_roles)

    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = current_user()
            if user is None:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Authentication required"}), 401
                return redirect(url_for("login_page", next=request.path))
            if user["role_code"] not in allowed:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Access denied"}), 403
                return redirect(ROLE_HOME.get(user["role_code"], "/login"))
            return view(*args, **kwargs)
        return wrapped
    return decorator


@auth.post("/login")
def login_api():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip().lower()
    password = str(body.get("password", ""))

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, worker_id, username, password_hash,
                       display_name, role_code, active,
                       (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP)
                           AS is_locked
                FROM app_user
                WHERE LOWER(username) = %s
                """,
                (username,),
            )
            user = cursor.fetchone()

            if user is None or not user["active"] or user["is_locked"]:
                _record_auth_event(
                    cursor, "LOGIN", "BLOCKED" if user and user["is_locked"] else "DENIED",
                    username, user["user_id"] if user else None,
                )
                return jsonify({"error": "Invalid username or password"}), 401

            if not check_password_hash(user["password_hash"], password):
                cursor.execute(
                    """
                    UPDATE app_user
                    SET failed_login_count = failed_login_count + 1,
                        locked_until = CASE
                            WHEN failed_login_count + 1 >= 5
                            THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                            ELSE locked_until
                        END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                    """,
                    (user["user_id"],),
                )
                _record_auth_event(cursor, "LOGIN", "DENIED", username, user["user_id"])
                return jsonify({"error": "Invalid username or password"}), 401

            cursor.execute(
                """
                UPDATE app_user
                SET failed_login_count = 0, locked_until = NULL,
                    last_login_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s
                """,
                (user["user_id"],),
            )
            _record_auth_event(cursor, "LOGIN", "SUCCESS", username, user["user_id"])

    session.clear()
    session["user_id"] = user["user_id"]
    session["role_code"] = user["role_code"]
    session.permanent = True

    return jsonify({
        "authenticated": True,
        "user": {
            "user_id": user["user_id"],
            "worker_id": user["worker_id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role_code"],
        },
        "redirect_to": ROLE_HOME[user["role_code"]],
    })


@auth.post("/logout")
def logout_api():
    user_id = session.get("user_id")
    session.clear()
    if user_id:
        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    _record_auth_event(cursor, "LOGOUT", "SUCCESS", "", user_id)
        except Exception:
            current_app.logger.exception("Unable to record logout audit event")
    return jsonify({"authenticated": False}), 200


@auth.get("/me")
def me_api():
    user = current_user()
    if user is None:
        return jsonify({"authenticated": False}), 401
    return jsonify({
        "authenticated": True,
        "user": {
            "user_id": user["user_id"],
            "worker_id": user["worker_id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role_code"],
            "employee_number": user["employee_number"],
            "job_classification": user["job_classification"],
            "union_local_code": user["union_local_code"],
        },
    })
