from flask import Blueprint, jsonify, request
from psycopg import errors
from psycopg.types.json import Jsonb
from werkzeug.security import generate_password_hash

from auth import current_user, roles_required
from db import get_connection


terminal_admin = Blueprint("terminal_admin", __name__)
ALLOWED_ZONE_TYPES = {"CONTAINER", "REEFER", "HAZARDOUS", "EMPTY", "GENERAL_CARGO", "WAREHOUSE", "GATE", "ROAD", "BERTH", "RAIL", "INSPECTION", "SECURE_HOLD", "MAINTENANCE", "STAGING", "OTHER"}
ALLOWED_ROLES = {"OPERATOR", "SUPERVISOR", "DISPATCHER", "SECURITY", "HR_PAYROLL", "ADMIN"}


def _integer(body, name, minimum, maximum):
    try:
        value = int(body.get(name))
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a whole number") from None
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def _terminal_exists(cursor, terminal_id):
    cursor.execute("SELECT terminal_id FROM terminal WHERE terminal_id=%s AND active=TRUE", (terminal_id,))
    return cursor.fetchone() is not None


@terminal_admin.get("/terminals")
@roles_required("SUPERVISOR", "DISPATCHER", "SECURITY", "HR_PAYROLL", "ADMIN")
def list_terminals():
    user = current_user()
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""SELECT DISTINCT t.terminal_id,t.terminal_code,t.terminal_name,t.timezone_name,t.active
                FROM terminal t LEFT JOIN user_terminal_access a ON a.terminal_id=t.terminal_id
                WHERE t.active=TRUE AND (%s='ADMIN' OR a.user_id=%s) ORDER BY t.terminal_name""",
                (user["role_code"], user["user_id"]))
            rows = cursor.fetchall()
    return jsonify({"terminals": rows})


@terminal_admin.get("/terminals/<int:terminal_id>/configuration")
@roles_required("SUPERVISOR", "DISPATCHER", "SECURITY", "ADMIN")
def get_terminal_configuration(terminal_id):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT terminal_id,terminal_code,terminal_name,timezone_name FROM terminal WHERE terminal_id=%s", (terminal_id,))
            terminal = cursor.fetchone()
            if terminal is None:
                return jsonify({"error": "Terminal not found"}), 404
            cursor.execute("SELECT * FROM terminal_configuration WHERE terminal_id=%s", (terminal_id,))
            config = cursor.fetchone()
            cursor.execute("SELECT * FROM terminal_zone WHERE terminal_id=%s ORDER BY zone_code", (terminal_id,))
            zones = cursor.fetchall()
            cursor.execute("""SELECT b.* FROM terminal_yard_block b JOIN terminal_zone z ON z.terminal_zone_id=b.terminal_zone_id
                WHERE z.terminal_id=%s ORDER BY z.zone_code,b.block_code""", (terminal_id,))
            blocks = cursor.fetchall()
    return jsonify({"terminal": terminal, "configuration": config, "zones": zones, "blocks": blocks})


@terminal_admin.put("/terminals/<int:terminal_id>/configuration")
@roles_required("ADMIN")
def update_terminal_configuration(terminal_id):
    body, user = request.get_json(silent=True) or {}, current_user()
    country_code = str(body.get("country_code", "US")).strip().upper()
    if len(country_code) != 2 or not country_code.isalpha():
        return jsonify({"error": "country_code must be a two-letter code"}), 400
    with get_connection() as connection:
        with connection.cursor() as cursor:
            if not _terminal_exists(cursor, terminal_id):
                return jsonify({"error": "Terminal not found"}), 404
            cursor.execute("""INSERT INTO terminal_configuration
                (terminal_id,country_code,jurisdiction_code,configuration,security_policy,inspection_policy,updated_by_user_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (terminal_id) DO UPDATE SET
                country_code=EXCLUDED.country_code,jurisdiction_code=EXCLUDED.jurisdiction_code,
                configuration=EXCLUDED.configuration,security_policy=EXCLUDED.security_policy,
                inspection_policy=EXCLUDED.inspection_policy,updated_by_user_id=EXCLUDED.updated_by_user_id,
                map_version=terminal_configuration.map_version+1,updated_at=CURRENT_TIMESTAMP RETURNING *""",
                (terminal_id,country_code,body.get("jurisdiction_code"),Jsonb(body.get("configuration", {})),
                 Jsonb(body.get("security_policy", {})),Jsonb(body.get("inspection_policy", {})),user["user_id"]))
            config = cursor.fetchone()
    return jsonify({"configuration": config})


@terminal_admin.post("/terminals/<int:terminal_id>/zones")
@roles_required("ADMIN")
def create_terminal_zone(terminal_id):
    body = request.get_json(silent=True) or {}
    zone_code, zone_name = str(body.get("zone_code", "")).strip().upper(), str(body.get("zone_name", "")).strip()
    zone_type = str(body.get("zone_type", "OTHER")).strip().upper()
    if not zone_code or not zone_name:
        return jsonify({"error": "zone_code and zone_name are required"}), 400
    if zone_type not in ALLOWED_ZONE_TYPES:
        return jsonify({"error": "Unsupported zone_type"}), 400
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                if not _terminal_exists(cursor, terminal_id):
                    return jsonify({"error": "Terminal not found"}), 404
                cursor.execute("""INSERT INTO terminal_zone
                    (terminal_id,zone_code,zone_name,zone_type,geometry,capacity_units,restricted,active)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                    (terminal_id,zone_code,zone_name,zone_type,Jsonb(body.get("geometry", {})),body.get("capacity_units"),
                     bool(body.get("restricted", False)),bool(body.get("active", True))))
                zone = cursor.fetchone()
    except errors.UniqueViolation:
        return jsonify({"error": "Zone code already exists for this terminal"}), 409
    return jsonify({"zone": zone}), 201


@terminal_admin.put("/zones/<int:zone_id>")
@roles_required("ADMIN")
def update_terminal_zone(zone_id):
    body = request.get_json(silent=True) or {}
    zone_type = str(body.get("zone_type", "OTHER")).strip().upper()
    if zone_type not in ALLOWED_ZONE_TYPES:
        return jsonify({"error": "Unsupported zone_type"}), 400
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""UPDATE terminal_zone SET zone_name=%s,zone_type=%s,geometry=%s,capacity_units=%s,
                restricted=%s,active=%s WHERE terminal_zone_id=%s RETURNING *""",
                (str(body.get("zone_name", "")).strip(),zone_type,Jsonb(body.get("geometry", {})),body.get("capacity_units"),
                 bool(body.get("restricted", False)),bool(body.get("active", True)),zone_id))
            zone = cursor.fetchone()
    return (jsonify({"zone": zone}), 200) if zone else (jsonify({"error": "Zone not found"}), 404)


@terminal_admin.post("/zones/<int:zone_id>/blocks")
@roles_required("ADMIN")
def create_yard_block(zone_id):
    body = request.get_json(silent=True) or {}
    block_code = str(body.get("block_code", "")).strip().upper()
    if not block_code:
        return jsonify({"error": "block_code is required"}), 400
    try:
        rows, bays, tiers = _integer(body, "row_count", 1, 100), _integer(body, "bay_count", 1, 500), _integer(body, "tier_count", 1, 12)
        length = int(body.get("slot_length_feet", 40))
        if length not in {20, 40, 45, 48, 53}:
            raise ValueError("slot_length_feet is unsupported")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT terminal_zone_id FROM terminal_zone WHERE terminal_zone_id=%s", (zone_id,))
                if cursor.fetchone() is None:
                    return jsonify({"error": "Zone not found"}), 404
                cursor.execute("""INSERT INTO terminal_yard_block
                    (terminal_zone_id,block_code,block_name,row_count,bay_count,tier_count,slot_length_feet,max_weight_kg,rules,geometry)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                    (zone_id,block_code,body.get("block_name"),rows,bays,tiers,length,body.get("max_weight_kg"),
                     Jsonb(body.get("rules", {})),Jsonb(body.get("geometry", {}))))
                block = cursor.fetchone()
    except errors.UniqueViolation:
        return jsonify({"error": "Block code already exists in this zone"}), 409
    return jsonify({"block": block, "configured_slots": rows * bays * tiers}), 201


@terminal_admin.get("/users")
@roles_required("ADMIN")
def list_users():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""SELECT user_id,worker_id,username,display_name,role_code,active,must_change_password,last_login_at
                FROM app_user ORDER BY display_name""")
            users = cursor.fetchall()
    return jsonify({"users": users})


@terminal_admin.post("/users")
@roles_required("ADMIN")
def create_user():
    body = request.get_json(silent=True) or {}
    username, display_name, password = str(body.get("username", "")).strip().lower(), str(body.get("display_name", "")).strip(), str(body.get("password", ""))
    role = str(body.get("role", "")).strip().upper()
    if not username or not display_name or len(password) < 12 or role not in ALLOWED_ROLES:
        return jsonify({"error": "Valid username, display_name, role and 12-character password are required"}), 400
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("""INSERT INTO app_user (worker_id,username,password_hash,display_name,role_code,must_change_password)
                    VALUES (%s,%s,%s,%s,%s,TRUE) RETURNING user_id,username,display_name,role_code,active""",
                    (body.get("worker_id"),username,generate_password_hash(password),display_name,role))
                user = cursor.fetchone()
                for terminal_id in body.get("terminal_ids", []):
                    cursor.execute("INSERT INTO user_terminal_access (user_id,terminal_id,access_level) VALUES (%s,%s,%s)",
                                   (user["user_id"],terminal_id,"ADMIN" if role == "ADMIN" else "STANDARD"))
    except errors.UniqueViolation:
        return jsonify({"error": "Username or worker link already exists"}), 409
    return jsonify({"user": user}), 201
