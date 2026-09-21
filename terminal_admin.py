from flask import Blueprint, jsonify, request

from auth import current_user, roles_required
from db import get_connection


terminal_admin = Blueprint("terminal_admin", __name__)

ALLOWED_ZONE_TYPES = {
    "CONTAINER", "REEFER", "HAZARDOUS", "EMPTY", "GENERAL_CARGO",
    "WAREHOUSE", "GATE", "ROAD", "BERTH", "RAIL", "INSPECTION",
    "SECURE_HOLD", "MAINTENANCE", "STAGING", "OTHER",
}


@terminal_admin.get("/terminals")
@roles_required("SUPERVISOR", "DISPATCHER", "SECURITY", "HR_PAYROLL", "ADMIN")
def list_terminals():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT terminal_id, terminal_code, terminal_name, timezone_name, active FROM terminal ORDER BY terminal_name")
            rows = cursor.fetchall()
    return jsonify({"terminals": rows})


@terminal_admin.get("/terminals/<int:terminal_id>/configuration")
@roles_required("SUPERVISOR", "DISPATCHER", "SECURITY", "ADMIN")
def get_terminal_configuration(terminal_id):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM terminal_configuration WHERE terminal_id = %s", (terminal_id,))
            config = cursor.fetchone()
            cursor.execute("SELECT * FROM terminal_zone WHERE terminal_id = %s ORDER BY zone_code", (terminal_id,))
            zones = cursor.fetchall()
    return jsonify({"configuration": config, "zones": zones})


@terminal_admin.put("/terminals/<int:terminal_id>/configuration")
@roles_required("ADMIN")
def update_terminal_configuration(terminal_id):
    body = request.get_json(silent=True) or {}
    user = current_user()
    country_code = str(body.get("country_code", "US")).strip().upper()
    if len(country_code) != 2:
        return jsonify({"error": "country_code must be a two-letter code"}), 400
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT terminal_id FROM terminal WHERE terminal_id = %s", (terminal_id,))
            if cursor.fetchone() is None:
                return jsonify({"error": "Terminal not found"}), 404
            cursor.execute(
                """
                INSERT INTO terminal_configuration (
                    terminal_id, country_code, jurisdiction_code, configuration,
                    security_policy, inspection_policy, updated_by_user_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (terminal_id) DO UPDATE SET
                    country_code = EXCLUDED.country_code,
                    jurisdiction_code = EXCLUDED.jurisdiction_code,
                    configuration = EXCLUDED.configuration,
                    security_policy = EXCLUDED.security_policy,
                    inspection_policy = EXCLUDED.inspection_policy,
                    updated_by_user_id = EXCLUDED.updated_by_user_id,
                    map_version = terminal_configuration.map_version + 1,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
                """,
                (terminal_id, country_code, body.get("jurisdiction_code"),
                 body.get("configuration", {}), body.get("security_policy", {}),
                 body.get("inspection_policy", {}), user["user_id"]),
            )
            config = cursor.fetchone()
    return jsonify({"configuration": config})


@terminal_admin.post("/terminals/<int:terminal_id>/zones")
@roles_required("ADMIN")
def create_terminal_zone(terminal_id):
    body = request.get_json(silent=True) or {}
    zone_code = str(body.get("zone_code", "")).strip().upper()
    zone_name = str(body.get("zone_name", "")).strip()
    zone_type = str(body.get("zone_type", "OTHER")).strip().upper()
    if not zone_code or not zone_name:
        return jsonify({"error": "zone_code and zone_name are required"}), 400
    if zone_type not in ALLOWED_ZONE_TYPES:
        return jsonify({"error": "Unsupported zone_type"}), 400
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO terminal_zone (
                    terminal_id, zone_code, zone_name, zone_type, geometry,
                    capacity_units, restricted, active
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
                """,
                (terminal_id, zone_code, zone_name, zone_type,
                 body.get("geometry", {}), body.get("capacity_units"),
                 bool(body.get("restricted", False)), bool(body.get("active", True))),
            )
            zone = cursor.fetchone()
    return jsonify({"zone": zone}), 201
