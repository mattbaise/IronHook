import hashlib
import hmac
import io
import os

from datetime import datetime, timezone

import qrcode
from flask import Blueprint, jsonify, request, send_file
from psycopg import errors

from db import get_connection
from validation import (
    require_positive_integer,
    validate_confirmation_method,
    validate_operating_minutes,
)


api = Blueprint("api", __name__)


def error_response(message, status_code):
    return jsonify({"error": message}), status_code


@api.get("/health")
def health():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT CURRENT_TIMESTAMP AS database_time")
                row = cursor.fetchone()
    except Exception:
        return jsonify({"status": "unavailable", "database": "disconnected"}), 503

    return jsonify(
        {
            "status": "ok",
            "database": "connected",
            "database_time": row["database_time"],
        }
    )


@api.get("/containers")
def list_containers():
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip().upper()

    conditions = []
    parameters = []

    if search:
        conditions.append("c.container_number ILIKE %s")
        parameters.append(f"%{search}%")

    if status:
        conditions.append("c.current_status = %s")
        parameters.append(status)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT
            c.container_number,
            c.iso_type_code,
            c.length_feet,
            c.shipping_line,
            c.load_status,
            c.movement_category,
            c.outbound_destination,
            c.current_status,
            c.customs_hold,
            c.security_hold,
            yl.zone_code,
            yl.block_code,
            yl.row_code,
            yl.bay_number,
            yl.tier_number
        FROM container c
        LEFT JOIN yard_location yl
            ON yl.yard_location_id = c.current_location_id
        {where_clause}
        ORDER BY c.container_number
        LIMIT 100
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, parameters)
            rows = cursor.fetchall()

    return jsonify({"count": len(rows), "containers": rows})


@api.get("/containers/<string:container_number>")
def get_container(container_number):
    normalized_number = container_number.replace("-", "").replace(" ", "").upper()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    c.*,
                    yl.zone_code,
                    yl.block_code,
                    yl.row_code,
                    yl.bay_number,
                    yl.tier_number,
                    vv.vessel_name,
                    vv.voyage_number
                FROM container c
                LEFT JOIN yard_location yl
                    ON yl.yard_location_id = c.current_location_id
                LEFT JOIN vessel_visit vv
                    ON vv.vessel_visit_id = c.vessel_visit_id
                WHERE c.container_number = %s
                """,
                (normalized_number,),
            )
            container = cursor.fetchone()

            if not container:
                return error_response("Container not found", 404)

            cursor.execute(
                """
                SELECT
                    cm.container_move_id,
                    cm.move_type,
                    cm.started_at,
                    cm.completed_at,
                    cm.confirmation_method,
                    cm.source_system,
                    cm.source_reference,
                    w.first_name || ' ' || w.last_name AS worker_name,
                    e.equipment_code
                FROM container_move cm
                LEFT JOIN worker w ON w.worker_id = cm.worker_id
                LEFT JOIN equipment e ON e.equipment_id = cm.equipment_id
                WHERE cm.container_id = %s
                ORDER BY cm.started_at DESC
                """,
                (container["container_id"],),
            )
            movement_history = cursor.fetchall()

    return jsonify({"container": container, "movement_history": movement_history})


@api.get("/yard/capacity")
def yard_capacity():
    terminal_id = request.args.get("terminal_id")

    query = "SELECT * FROM yard_block_summary"
    parameters = []

    if terminal_id is not None:
        try:
            terminal_id = require_positive_integer(terminal_id, "terminal_id")
        except ValueError as error:
            return error_response(str(error), 400)

        query += " WHERE terminal_id = %s"
        parameters.append(terminal_id)

    query += " ORDER BY zone_code, block_code"

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, parameters)
            rows = cursor.fetchall()

    return jsonify({"blocks": rows})


@api.get("/workers/<int:worker_id>/credential")
def worker_credential_detail(worker_id):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    w.worker_id,
                    w.employee_number,
                    w.first_name,
                    w.last_name,
                    w.job_classification,
                    w.union_local_code,
                    w.union_status,
                    w.union_join_year,
                    w.active,
                    wc.credential_id,
                    wc.credential_code,
                    wc.credential_status,
                    wc.issued_at,
                    wc.expires_at
                FROM worker w
                LEFT JOIN worker_credential wc
                    ON wc.worker_id = w.worker_id
                WHERE w.worker_id = %s
                """,
                (worker_id,),
            )

            worker = cursor.fetchone()

            if worker is None:
                return error_response(
                    "Worker not found",
                    404,
                )

            cursor.execute(
                """
                SELECT
                    certification_id,
                    certification_code,
                    certification_name,
                    issued_at,
                    expires_at,
                    certification_status
                FROM worker_certification
                WHERE worker_id = %s
                ORDER BY certification_name
                """,
                (worker_id,),
            )

            certifications = cursor.fetchall()

    return jsonify(
        {
            "worker": worker,
            "certifications": certifications,
        }
    )


@api.get("/workers")
def list_workers():
    active_value = request.args.get("active")

    parameters = []
    where_clause = ""

    if active_value is not None:
        normalized = active_value.strip().lower()

        if normalized not in {"true", "false"}:
            return error_response(
                "active must be true or false",
                400,
            )

        where_clause = "WHERE active = %s"
        parameters.append(
            normalized == "true"
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    worker_id,
                    employee_number,
                    first_name,
                    last_name,
                    job_classification,
                    union_local_code,
                    union_status,
                    union_join_year,
                    active
                FROM worker
                {where_clause}
                ORDER BY last_name, first_name
                """,
                parameters,
            )

            rows = cursor.fetchall()

    return jsonify(
        {
            "count": len(rows),
            "workers": rows,
        }
    )


@api.get("/shifts")
def list_shifts():
    terminal_id = request.args.get("terminal_id")

    parameters = []
    where_clause = ""

    if terminal_id is not None:
        try:
            terminal_id = require_positive_integer(
                terminal_id,
                "terminal_id",
            )
        except ValueError as error:
            return error_response(
                str(error),
                400,
            )

        where_clause = "WHERE terminal_id = %s"
        parameters.append(terminal_id)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    shift_id,
                    terminal_id,
                    shift_name,
                    starts_at,
                    ends_at,
                    shift_status
                FROM work_shift
                {where_clause}
                ORDER BY starts_at DESC
                """,
                parameters,
            )

            rows = cursor.fetchall()

    return jsonify(
        {
            "count": len(rows),
            "shifts": rows,
        }
    )


@api.get("/equipment")
def list_equipment():
    terminal_id = request.args.get("terminal_id")
    parameters = []
    where_clause = ""

    if terminal_id is not None:
        try:
            terminal_id = require_positive_integer(terminal_id, "terminal_id")
        except ValueError as error:
            return error_response(str(error), 400)

        where_clause = "WHERE terminal_id = %s"
        parameters.append(terminal_id)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    equipment_id,
                    equipment_code,
                    equipment_type,
                    operating_status,
                    total_operating_hours,
                    total_mileage
                FROM equipment
                {where_clause}
                ORDER BY equipment_type, equipment_code
                """,
                parameters,
            )
            rows = cursor.fetchall()

    return jsonify({"count": len(rows), "equipment": rows})


@api.get("/dashboard/summary")
def dashboard_summary():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COUNT(*) FILTER (
                        WHERE current_status IN
                        ('IN_YARD', 'ON_HOLD', 'RELEASED', 'OUTBOUND_STAGED')
                    ) AS containers_in_yard,
                    COUNT(*) FILTER (WHERE current_status = 'ON_HOLD') AS containers_on_hold,
                    COUNT(*) FILTER (WHERE current_status = 'EXPECTED') AS expected_containers
                FROM container
                """
            )
            containers = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(occupied_spaces), 0) AS occupied_spaces,
                    COALESCE(SUM(open_spaces), 0) AS open_spaces,
                    COALESCE(SUM(unavailable_spaces), 0) AS unavailable_spaces,
                    COALESCE(SUM(total_spaces), 0) AS total_spaces
                FROM yard_block_summary
                """
            )
            yard = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_equipment,
                    COUNT(*) FILTER (WHERE operating_status = 'READY') AS ready,
                    COUNT(*) FILTER (WHERE operating_status = 'ASSIGNED') AS assigned,
                    COUNT(*) FILTER (
                        WHERE operating_status IN ('RESTRICTED', 'DOWN', 'MAINTENANCE')
                    ) AS attention
                FROM equipment
                """
            )
            equipment = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    COUNT(*) FILTER (
                        WHERE assignment_status IN
                        ('QUEUED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED')
                    ) AS active,
                    COUNT(*) FILTER (WHERE assignment_status = 'PAUSED' OR safety_stop) AS paused,
                    COUNT(*) FILTER (WHERE assignment_status = 'COMPLETED') AS completed
                FROM move_assignment
                """
            )
            assignments = cursor.fetchone()

    usable_spaces = yard["occupied_spaces"] + yard["open_spaces"]
    occupancy_percent = 0
    if usable_spaces:
        occupancy_percent = round(100 * yard["occupied_spaces"] / usable_spaces, 1)

    return jsonify(
        {
            "containers": containers,
            "yard": {**yard, "occupancy_percent": occupancy_percent},
            "equipment": equipment,
            "assignments": assignments,
        }
    )


@api.get("/assignments")
def list_assignments():
    shift_id = request.args.get("shift_id")
    requested_status = request.args.get("status", "").strip().upper()

    conditions = []
    parameters = []

    if shift_id:
        try:
            shift_id = require_positive_integer(shift_id, "shift_id")
        except ValueError as error:
            return error_response(str(error), 400)

        conditions.append("ma.shift_id = %s")
        parameters.append(shift_id)

    if requested_status:
        conditions.append("ma.assignment_status = %s")
        parameters.append(requested_status)
    else:
        conditions.append(
            "ma.assignment_status IN "
            "('QUEUED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED')"
        )

    query = f"""
        SELECT
            ma.assignment_id,
            ma.priority_number,
            ma.assignment_status,
            ma.assigned_at,
            ma.accepted_at,
            ma.safety_stop,
            c.container_number,
            c.current_status AS container_status,
            c.customs_hold,
            c.security_hold,
            w.first_name || ' ' || w.last_name AS worker_name,
            e.equipment_code,
            e.operating_status AS equipment_status,
            pickup.zone_code AS pickup_zone,
            pickup.block_code AS pickup_block,
            pickup.row_code AS pickup_row,
            pickup.bay_number AS pickup_bay,
            pickup.tier_number AS pickup_tier,
            delivery.zone_code AS delivery_zone,
            delivery.block_code AS delivery_block,
            delivery.row_code AS delivery_row,
            delivery.bay_number AS delivery_bay,
            delivery.tier_number AS delivery_tier
        FROM move_assignment ma
        JOIN container c ON c.container_id = ma.container_id
        LEFT JOIN worker w ON w.worker_id = ma.worker_id
        LEFT JOIN equipment e ON e.equipment_id = ma.equipment_id
        LEFT JOIN yard_location pickup
            ON pickup.yard_location_id = ma.pickup_location_id
        LEFT JOIN yard_location delivery
            ON delivery.yard_location_id = ma.delivery_location_id
        WHERE {" AND ".join(conditions)}
        ORDER BY ma.priority_number, ma.assigned_at
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, parameters)
            rows = cursor.fetchall()

    return jsonify({"count": len(rows), "assignments": rows})


@api.post("/assignments/<int:assignment_id>/start")
def start_assignment(assignment_id):
    body = request.get_json(silent=True) or {}

    try:
        worker_id = require_positive_integer(body.get("worker_id"), "worker_id")
    except ValueError as error:
        return error_response(str(error), 400)

    now = datetime.now(timezone.utc)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT ma.*, c.customs_hold, c.security_hold,
                           e.operating_status
                    FROM move_assignment ma
                    JOIN container c ON c.container_id = ma.container_id
                    LEFT JOIN equipment e ON e.equipment_id = ma.equipment_id
                    WHERE ma.assignment_id = %s
                    FOR UPDATE OF ma
                    """,
                    (assignment_id,),
                )
                assignment = cursor.fetchone()

                if not assignment:
                    return error_response("Assignment not found", 404)

                if assignment["assignment_status"] not in {"QUEUED", "ASSIGNED", "ACCEPTED"}:
                    return error_response("Assignment cannot be started from its current status", 409)

                if assignment["safety_stop"]:
                    return error_response("Assignment is under a safety stop", 409)

                if assignment["customs_hold"] or assignment["security_hold"]:
                    return error_response("Container is on hold and cannot be moved", 409)

                if assignment["operating_status"] in {"DOWN", "MAINTENANCE", "RESTRICTED"}:
                    return error_response("Assigned equipment is not cleared for normal service", 409)

                if assignment["worker_id"] not in {None, worker_id}:
                    return error_response("Assignment belongs to another worker", 403)

                cursor.execute(
                    """
                    UPDATE move_assignment
                    SET worker_id = %s,
                        assignment_status = 'IN_PROGRESS',
                        accepted_at = COALESCE(accepted_at, %s)
                    WHERE assignment_id = %s
                    RETURNING *
                    """,
                    (worker_id, now, assignment_id),
                )
                updated_assignment = cursor.fetchone()

                if assignment["equipment_id"]:
                    cursor.execute(
                        """
                        UPDATE equipment
                        SET operating_status = 'ASSIGNED'
                        WHERE equipment_id = %s
                        """,
                        (assignment["equipment_id"],),
                    )

                cursor.execute(
                    """
                    INSERT INTO audit_event (
                        terminal_id, worker_id, entity_type, entity_id,
                        action_name, reason, after_data
                    )
                    SELECT
                        ws.terminal_id, %s, 'MOVE_ASSIGNMENT', %s,
                        'ASSIGNMENT_STARTED', 'Worker accepted and started assignment',
                        jsonb_build_object('status', 'IN_PROGRESS')
                    FROM work_shift ws
                    WHERE ws.shift_id = %s
                    """,
                    (worker_id, assignment_id, assignment["shift_id"]),
                )

    except errors.ForeignKeyViolation:
        return error_response("Worker does not exist", 400)

    return jsonify({"message": "Assignment started", "assignment": updated_assignment})


@api.post("/assignments/<int:assignment_id>/complete")
def complete_assignment(assignment_id):
    body = request.get_json(silent=True) or {}

    try:
        worker_id = require_positive_integer(body.get("worker_id"), "worker_id")
        confirmation_method = validate_confirmation_method(
            body.get("confirmation_method")
        )
        operating_minutes = validate_operating_minutes(body.get("operating_minutes"))
    except ValueError as error:
        return error_response(str(error), 400)

    notes = str(body.get("notes", "")).strip() or None
    now = datetime.now(timezone.utc)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        ma.*,
                        c.current_location_id,
                        c.customs_hold,
                        c.security_hold,
                        e.operating_status,
                        destination.zone_code AS destination_zone,
                        destination.is_open AS destination_is_open,
                        destination.is_serviceable AS destination_is_serviceable
                    FROM move_assignment ma
                    JOIN container c ON c.container_id = ma.container_id
                    LEFT JOIN equipment e ON e.equipment_id = ma.equipment_id
                    LEFT JOIN yard_location destination
                        ON destination.yard_location_id = ma.delivery_location_id
                    WHERE ma.assignment_id = %s
                    FOR UPDATE OF ma, c
                    """,
                    (assignment_id,),
                )
                assignment = cursor.fetchone()

                if not assignment:
                    return error_response("Assignment not found", 404)

                if assignment["assignment_status"] != "IN_PROGRESS":
                    return error_response("Only an in-progress assignment can be completed", 409)

                if assignment["worker_id"] != worker_id:
                    return error_response("Only the assigned worker can complete this move", 403)

                if assignment["safety_stop"]:
                    return error_response("Resolve the safety stop before completing the move", 409)

                if assignment["customs_hold"] or assignment["security_hold"]:
                    return error_response("Container is on hold and cannot be moved", 409)

                if assignment["operating_status"] in {"DOWN", "MAINTENANCE"}:
                    return error_response("Equipment is out of service", 409)

                destination_id = assignment["delivery_location_id"]

                if destination_id:
                    if not assignment["destination_is_open"] or not assignment["destination_is_serviceable"]:
                        return error_response("Destination position is unavailable", 409)

                    cursor.execute(
                        """
                        SELECT container_number
                        FROM container
                        WHERE current_location_id = %s
                          AND container_id <> %s
                          AND current_status IN
                              ('IN_YARD', 'ON_HOLD', 'RELEASED', 'OUTBOUND_STAGED')
                        FOR UPDATE
                        """,
                        (destination_id, assignment["container_id"]),
                    )
                    occupying_container = cursor.fetchone()

                    if occupying_container:
                        return error_response(
                            f"Destination is occupied by {occupying_container['container_number']}",
                            409,
                        )

                move_type = "OUTBOUND_STAGE" if assignment["destination_zone"] == "OUTBOUND" else "YARD_PLACE"
                new_status = "OUTBOUND_STAGED" if assignment["destination_zone"] == "OUTBOUND" else "IN_YARD"
                started_at = assignment["accepted_at"] or assignment["assigned_at"] or now

                cursor.execute(
                    """
                    INSERT INTO container_move (
                        container_id, assignment_id, shift_id, worker_id,
                        equipment_id, from_location_id, to_location_id,
                        move_type, started_at, completed_at,
                        confirmation_method, notes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING container_move_id
                    """,
                    (
                        assignment["container_id"], assignment_id,
                        assignment["shift_id"], worker_id,
                        assignment["equipment_id"], assignment["current_location_id"],
                        destination_id, move_type, started_at, now,
                        confirmation_method, notes,
                    ),
                )
                move = cursor.fetchone()

                cursor.execute(
                    """
                    UPDATE container
                    SET current_location_id = %s,
                        current_status = %s,
                        updated_at = %s
                    WHERE container_id = %s
                    """,
                    (destination_id, new_status, now, assignment["container_id"]),
                )

                cursor.execute(
                    """
                    UPDATE move_assignment
                    SET assignment_status = 'COMPLETED', completed_at = %s
                    WHERE assignment_id = %s
                    """,
                    (now, assignment_id),
                )

                if assignment["equipment_id"]:
                    cursor.execute(
                        """
                        UPDATE equipment
                        SET operating_status = 'READY',
                            total_operating_hours = total_operating_hours + (%s / 60.0)
                        WHERE equipment_id = %s
                        """,
                        (operating_minutes, assignment["equipment_id"]),
                    )

                cursor.execute(
                    """
                    INSERT INTO audit_event (
                        terminal_id, worker_id, entity_type, entity_id,
                        action_name, reason, after_data
                    )
                    SELECT
                        ws.terminal_id, %s, 'CONTAINER_MOVE', %s,
                        'MOVE_COMPLETED', %s,
                        jsonb_build_object(
                            'assignment_id', %s,
                            'container_id', %s,
                            'destination_id', %s,
                            'confirmation_method', %s
                        )
                    FROM work_shift ws
                    WHERE ws.shift_id = %s
                    """,
                    (
                        worker_id, move["container_move_id"],
                        notes or "Move completed by assigned worker",
                        assignment_id, assignment["container_id"],
                        destination_id, confirmation_method,
                        assignment["shift_id"],
                    ),
                )

    except errors.UniqueViolation:
        return error_response("Destination became occupied before completion; refresh the assignment", 409)
    except errors.ForeignKeyViolation:
        return error_response("A referenced worker or location does not exist", 400)

    return jsonify(
        {
            "message": "Move completed",
            "container_move_id": move["container_move_id"],
            "assignment_id": assignment_id,
            "container_status": new_status,
        }
    )


@api.post("/assignments/<int:assignment_id>/safety-stop")
def safety_stop_assignment(assignment_id):
    body = request.get_json(silent=True) or {}
    reason = str(body.get("reason", "")).strip()

    try:
        worker_id = require_positive_integer(body.get("worker_id"), "worker_id")
    except ValueError as error:
        return error_response(str(error), 400)

    if len(reason) < 5:
        return error_response("A clear safety-stop reason is required", 400)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE move_assignment
                SET safety_stop = TRUE,
                    assignment_status = 'PAUSED',
                    exception_reason = %s
                WHERE assignment_id = %s
                  AND assignment_status IN
                      ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED')
                RETURNING shift_id, equipment_id
                """,
                (reason, assignment_id),
            )
            assignment = cursor.fetchone()

            if not assignment:
                return error_response("Active assignment not found", 404)

            cursor.execute(
                """
                INSERT INTO audit_event (
                    terminal_id, worker_id, entity_type, entity_id,
                    action_name, reason, after_data
                )
                SELECT
                    ws.terminal_id, %s, 'MOVE_ASSIGNMENT', %s,
                    'SAFETY_STOP', %s,
                    jsonb_build_object('status', 'PAUSED', 'safety_stop', TRUE)
                FROM work_shift ws
                WHERE ws.shift_id = %s
                """,
                (worker_id, assignment_id, reason, assignment["shift_id"]),
            )

    return jsonify({"message": "Work paused and safety stop recorded"})


def get_credential_secret():
    secret = os.getenv(
        "IRONHOOK_CREDENTIAL_SECRET",
        "",
    )

    if not secret:
        return None

    return secret.encode("utf-8")


def credential_version(credential):
    version_time = (
        credential["last_rotated_at"]
        or credential["issued_at"]
    )

    return int(version_time.timestamp())


def build_credential_payload(credential):
    secret = get_credential_secret()

    if secret is None:
        raise RuntimeError(
            "Credential signing secret is not configured"
        )

    version = credential_version(
        credential
    )

    message = (
        f"1:"
        f"{credential['credential_id']}:"
        f"{version}"
    )

    signature = hmac.new(
        secret,
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return (
        "IRONHOOK:CREDENTIAL:"
        f"{message}:"
        f"{signature}"
    )


def create_qr_response(credential):
    payload = build_credential_payload(
        credential
    )

    qr_image = qrcode.make(payload)

    image_buffer = io.BytesIO()

    qr_image.save(
        image_buffer,
        format="PNG",
    )

    image_buffer.seek(0)

    return send_file(
        image_buffer,
        mimetype="image/png",
        download_name=(
            f"{credential['credential_code']}.png"
        ),
    )


@api.get("/workers/<int:worker_id>/credential/qr")
def get_worker_credential_qr(worker_id):
    if get_credential_secret() is None:
        return error_response(
            "Credential signing is not configured",
            503,
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    credential_id,
                    credential_code,
                    credential_status,
                    issued_at,
                    expires_at,
                    last_rotated_at
                FROM worker_credential
                WHERE worker_id = %s
                """,
                (worker_id,),
            )

            credential = cursor.fetchone()

    if credential is None:
        return error_response(
            "Worker credential not found",
            404,
        )

    if (
        credential["credential_status"]
        != "ACTIVE"
    ):
        return error_response(
            "Credential is not active",
            403,
        )

    if (
        credential["expires_at"] is not None
        and credential["expires_at"]
        <= datetime.now(timezone.utc)
    ):
        return error_response(
            "Credential has expired",
            403,
        )

    return create_qr_response(
        credential
    )


@api.post("/workers/<int:worker_id>/credential/qr/rotate")
def rotate_worker_credential_qr(worker_id):
    if get_credential_secret() is None:
        return error_response(
            "Credential signing is not configured",
            503,
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE worker_credential
                SET
                    last_rotated_at =
                        CURRENT_TIMESTAMP
                WHERE worker_id = %s
                  AND credential_status = 'ACTIVE'
                RETURNING
                    credential_id,
                    credential_code,
                    credential_status,
                    issued_at,
                    expires_at,
                    last_rotated_at
                """,
                (worker_id,),
            )

            credential = cursor.fetchone()

    if credential is None:
        return error_response(
            "Active worker credential not found",
            404,
        )

    return create_qr_response(
        credential
    )


@api.post("/credentials/scan")
def scan_worker_credential():
    data = request.get_json(
        silent=True
    ) or {}

    payload = str(
        data.get("payload", "")
    ).strip()

    scan_type = str(
        data.get("scan_type", "")
    ).strip().upper()

    device_code = (
        str(
            data.get("device_code")
        ).strip()
        if data.get("device_code")
        else None
    )

    location_label = (
        str(
            data.get("location_label")
        ).strip()
        if data.get("location_label")
        else None
    )

    terminal_id = data.get(
        "terminal_id"
    )

    valid_scan_types = {
        "BADGE_IN",
        "HIRE_SELECTION",
        "EQUIPMENT_ASSIGNMENT",
        "GATE_ACCESS",
        "BADGE_OUT",
    }

    if not payload:
        return error_response(
            "payload is required",
            400,
        )

    if scan_type not in valid_scan_types:
        return error_response(
            "Invalid scan_type",
            400,
        )

    if get_credential_secret() is None:
        return error_response(
            "Credential signing is not configured",
            503,
        )

    if terminal_id is not None:
        try:
            terminal_id = (
                require_positive_integer(
                    terminal_id,
                    "terminal_id",
                )
            )
        except ValueError as error:
            return error_response(
                str(error),
                400,
            )

    parts = payload.split(":")

    if (
        len(parts) != 6
        or parts[0] != "IRONHOOK"
        or parts[1] != "CREDENTIAL"
        or parts[2] != "1"
    ):
        return error_response(
            "Invalid credential payload",
            401,
        )

    try:
        credential_id = int(parts[3])
        scanned_version = int(parts[4])
    except ValueError:
        return error_response(
            "Invalid credential payload",
            401,
        )

    supplied_signature = parts[5]

    message = (
        f"1:"
        f"{credential_id}:"
        f"{scanned_version}"
    )

    expected_signature = hmac.new(
        get_credential_secret(),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(
        supplied_signature,
        expected_signature,
    ):
        return error_response(
            "Invalid credential signature",
            401,
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    wc.credential_id,
                    wc.credential_code,
                    wc.credential_status,
                    wc.issued_at,
                    wc.expires_at,
                    wc.last_rotated_at,
                    w.worker_id,
                    w.employee_number,
                    w.first_name,
                    w.last_name,
                    w.job_classification,
                    w.active
                FROM worker_credential wc
                JOIN worker w
                    ON w.worker_id =
                       wc.worker_id
                WHERE wc.credential_id = %s
                """,
                (credential_id,),
            )

            credential = cursor.fetchone()

            if credential is None:
                return error_response(
                    "Credential not found",
                    401,
                )

            current_version = (
                credential_version(
                    credential
                )
            )

            version_matches = (
                scanned_version
                == current_version
            )

            not_expired = (
                credential["expires_at"]
                is None
                or credential["expires_at"]
                > datetime.now(
                    timezone.utc
                )
            )

            credential_allowed = (
                version_matches
                and credential[
                    "credential_status"
                ] == "ACTIVE"
                and credential["active"]
                and not_expired
            )

            scan_result = (
                "GRANTED"
                if credential_allowed
                else "DENIED"
            )

            denial_reason = None

            if not version_matches:
                denial_reason = (
                    "Credential has been rotated"
                )
            elif (
                credential[
                    "credential_status"
                ]
                != "ACTIVE"
            ):
                denial_reason = (
                    "Credential is not active"
                )
            elif not credential["active"]:
                denial_reason = (
                    "Worker is inactive"
                )
            elif not not_expired:
                denial_reason = (
                    "Credential has expired"
                )

            cursor.execute(
                """
                INSERT INTO
                    credential_scan_event (
                        credential_id,
                        terminal_id,
                        scan_type,
                        scan_result,
                        device_code,
                        location_label,
                        details
                    )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s::jsonb
                )
                RETURNING
                    scan_event_id,
                    scanned_at
                """,
                (
                    credential[
                        "credential_id"
                    ],
                    terminal_id,
                    scan_type,
                    scan_result,
                    device_code,
                    location_label,
                    "{}",
                ),
            )

            scan_event = (
                cursor.fetchone()
            )

    response = {
        "authorized":
            credential_allowed,
        "scan_result":
            scan_result,
        "denial_reason":
            denial_reason,
        "scan_event_id":
            scan_event[
                "scan_event_id"
            ],
        "scanned_at":
            scan_event[
                "scanned_at"
            ],
        "credential": {
            "credential_code":
                credential[
                    "credential_code"
                ],
            "employee_number":
                credential[
                    "employee_number"
                ],
            "worker_name":
                (
                    f"{credential['first_name']} "
                    f"{credential['last_name']}"
                ),
            "job_classification":
                credential[
                    "job_classification"
                ],
        },
    }

    if not credential_allowed:
        return jsonify(response), 403

    return jsonify(response), 200

