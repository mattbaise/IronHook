import hashlib
from decimal import Decimal

from flask import Blueprint, jsonify, request
from psycopg.types.json import Jsonb

from auth import current_user, roles_required
from db import get_connection


security_operations = Blueprint("security_operations", __name__)
SECURITY_ROLES = ("SECURITY", "SUPERVISOR", "ADMIN")
INSPECTION_STATES = {"REQUIRED", "IN_PROGRESS", "SECONDARY_REQUIRED", "CLEARED", "HELD", "ESCALATED"}
EVENT_TYPES = {"HOLD_PLACED", "STARTED", "CUSTODY_TRANSFER", "FINDING", "SECONDARY_REQUIRED", "CLEARED", "HELD", "ESCALATED", "DISPOSITION"}


def _clamp(value, low=0, high=100):
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        raise ValueError("Risk values must be whole numbers from 0 to 100") from None


def _deterministic_roll(container_number, salt):
    digest = hashlib.sha256(f"{container_number}:{salt}".encode()).hexdigest()
    return int(digest[:8], 16) % 10000 / 100


def _risk_score(body):
    weights = {"country_risk": Decimal(".30"), "route_risk": Decimal(".25"), "shipper_risk": Decimal(".20"), "anomaly_risk": Decimal(".25")}
    score, factors = Decimal("0"), []
    for name, weight in weights.items():
        value = _clamp(body.get(name, 0))
        score += Decimal(value) * weight
        if value:
            factors.append({"factor": name.replace("_risk", ""), "score": value})
    return int(score.quantize(Decimal("1"))), factors


def _band(score):
    return "CRITICAL" if score >= 85 else "HIGH" if score >= 65 else "MODERATE" if score >= 35 else "LOW"


def _audit(cursor, terminal_id, user, container_id, action, reason, data=None):
    cursor.execute(
        """INSERT INTO audit_event (terminal_id, worker_id, entity_type, entity_id,
               action_name, reason, after_data, source_system)
           VALUES (%s,%s,'CONTAINER',%s,%s,%s,%s,'IRONHOOK_SECURITY')""",
        (terminal_id, user.get("worker_id"), container_id, action, reason, Jsonb(data or {})),
    )


@security_operations.post("/containers/<int:container_id>/assess")
@roles_required(*SECURITY_ROLES)
def assess_container(container_id):
    body, user = request.get_json(silent=True) or {}, current_user()
    try:
        score, factors = _risk_score(body)
        random_rate = _clamp(body.get("random_inspection_percent", 5))
        threshold = _clamp(body.get("risk_threshold", 65))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""SELECT c.container_id, c.container_number,
                       COALESCE(v.terminal_id, yl.terminal_id) AS terminal_id
                FROM container c LEFT JOIN vessel_visit v ON v.vessel_visit_id=c.vessel_visit_id
                LEFT JOIN yard_location yl ON yl.yard_location_id=c.current_location_id
                WHERE c.container_id=%s""", (container_id,))
            container = cursor.fetchone()
            if container is None:
                return jsonify({"error": "Container not found"}), 404
            if container["terminal_id"] is None:
                return jsonify({"error": "Container is not assigned to a terminal"}), 409
            roll = _deterministic_roll(container["container_number"], body.get("selection_salt", "IRONHOOK-DEMO"))
            risk_selected, random_selected = score >= threshold, roll < random_rate
            method = "RISK_BASED" if risk_selected else "RANDOM" if random_selected else None
            cursor.execute("""INSERT INTO cargo_risk_assessment
                (container_id,terminal_id,assessment_version,risk_score,risk_band,indicators,source_summary)
                VALUES (%s,%s,'IRONHOOK-RISK-V1',%s,%s,%s,%s)
                RETURNING cargo_risk_assessment_id,assessed_at""",
                (container_id, container["terminal_id"], score, _band(score), Jsonb(factors), Jsonb({"random_roll": roll, "threshold": threshold})))
            assessment = cursor.fetchone()
            inspection = None
            if method:
                reason = "Risk threshold met" if risk_selected else "Randomized inspection"
                cursor.execute("""INSERT INTO cargo_inspection_selection
                    (container_id,terminal_id,cargo_risk_assessment_id,selection_method,selection_reason_code,selected_by_user_id)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    RETURNING inspection_selection_id,inspection_status,selected_at""",
                    (container_id, container["terminal_id"], assessment["cargo_risk_assessment_id"], method,
                     "RISK_THRESHOLD" if risk_selected else "RANDOM_POLICY", user["user_id"]))
                inspection = cursor.fetchone()
                cursor.execute("UPDATE container SET security_hold=TRUE,updated_at=CURRENT_TIMESTAMP WHERE container_id=%s", (container_id,))
                cursor.execute("""INSERT INTO cargo_inspection_event
                    (inspection_selection_id,event_type,notes,evidence,performed_by_user_id)
                    VALUES (%s,'SELECTED',%s,%s,%s)""",
                    (inspection["inspection_selection_id"], reason, Jsonb({"score": score}), user["user_id"]))
                _audit(cursor, container["terminal_id"], user, container_id, "SECURITY_HOLD_PLACED", reason,
                       {"inspection_id": inspection["inspection_selection_id"]})
    return jsonify({"container_id": container_id, "risk_score": score, "risk_band": _band(score), "indicators": factors,
                    "random_roll": roll, "selected_for_inspection": bool(method), "selection_method": method,
                    "assessment": assessment, "inspection": inspection})


@security_operations.get("/inspections")
@roles_required(*SECURITY_ROLES)
def list_inspections():
    status = request.args.get("status", "").strip().upper()
    if status and status not in INSPECTION_STATES:
        return jsonify({"error": "Unsupported inspection status"}), 400
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""SELECT s.*,c.container_number,r.risk_score,r.risk_band
                FROM cargo_inspection_selection s JOIN container c ON c.container_id=s.container_id
                LEFT JOIN cargo_risk_assessment r ON r.cargo_risk_assessment_id=s.cargo_risk_assessment_id
                WHERE (%s='' OR s.inspection_status=%s) ORDER BY s.selected_at DESC LIMIT 200""", (status, status))
            rows = cursor.fetchall()
    return jsonify({"count": len(rows), "inspections": rows})


@security_operations.get("/inspections/<int:inspection_id>")
@roles_required(*SECURITY_ROLES)
def inspection_detail(inspection_id):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""SELECT s.*,c.container_number,r.risk_score,r.risk_band,r.indicators
                FROM cargo_inspection_selection s JOIN container c ON c.container_id=s.container_id
                LEFT JOIN cargo_risk_assessment r ON r.cargo_risk_assessment_id=s.cargo_risk_assessment_id
                WHERE s.inspection_selection_id=%s""", (inspection_id,))
            inspection = cursor.fetchone()
            if inspection is None:
                return jsonify({"error": "Inspection not found"}), 404
            cursor.execute("""SELECT e.*,u.display_name AS performed_by FROM cargo_inspection_event e
                JOIN app_user u ON u.user_id=e.performed_by_user_id
                WHERE e.inspection_selection_id=%s ORDER BY e.happened_at""", (inspection_id,))
            events = cursor.fetchall()
    return jsonify({"inspection": inspection, "chain_of_custody": events})


@security_operations.post("/inspections/<int:inspection_id>/events")
@roles_required("SECURITY", "ADMIN")
def record_inspection_event(inspection_id):
    body, user = request.get_json(silent=True) or {}, current_user()
    event_type = str(body.get("event_type", "")).strip().upper()
    if event_type not in EVENT_TYPES:
        return jsonify({"error": "Unsupported inspection event type"}), 400
    status_by_event = {"STARTED": "IN_PROGRESS", "SECONDARY_REQUIRED": "SECONDARY_REQUIRED", "CLEARED": "CLEARED", "HELD": "HELD", "ESCALATED": "ESCALATED"}
    disposition = str(body.get("disposition", "")).strip().upper()
    if event_type == "DISPOSITION" and not disposition:
        return jsonify({"error": "Disposition is required"}), 400
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM cargo_inspection_selection WHERE inspection_selection_id=%s FOR UPDATE", (inspection_id,))
            inspection = cursor.fetchone()
            if inspection is None:
                return jsonify({"error": "Inspection not found"}), 404
            cursor.execute("""INSERT INTO cargo_inspection_event
                (inspection_selection_id,event_type,from_custodian,to_custodian,location_label,seal_number,notes,evidence,performed_by_user_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (inspection_id,event_type,body.get("from_custodian"),body.get("to_custodian"),body.get("location_label"),
                 body.get("seal_number"),body.get("notes"),Jsonb(body.get("evidence", {})),user["user_id"]))
            event = cursor.fetchone()
            next_status = status_by_event.get(event_type)
            if next_status:
                cursor.execute("""UPDATE cargo_inspection_selection SET inspection_status=%s,
                    started_at=CASE WHEN %s='IN_PROGRESS' THEN COALESCE(started_at,CURRENT_TIMESTAMP) ELSE started_at END,
                    completed_at=CASE WHEN %s IN ('CLEARED','HELD') THEN CURRENT_TIMESTAMP ELSE completed_at END,
                    cleared_by_user_id=CASE WHEN %s='CLEARED' THEN %s ELSE cleared_by_user_id END,
                    cleared_at=CASE WHEN %s='CLEARED' THEN CURRENT_TIMESTAMP ELSE cleared_at END
                    WHERE inspection_selection_id=%s""",
                    (next_status,next_status,next_status,next_status,user["user_id"],next_status,inspection_id))
            if event_type == "FINDING":
                cursor.execute("UPDATE cargo_inspection_selection SET findings=findings || %s WHERE inspection_selection_id=%s", (Jsonb(body.get("evidence", {})), inspection_id))
            if event_type == "DISPOSITION":
                cursor.execute("UPDATE cargo_inspection_selection SET disposition=%s,disposition_notes=%s WHERE inspection_selection_id=%s", (disposition, body.get("notes"), inspection_id))
            if event_type == "CLEARED":
                cursor.execute("UPDATE container SET security_hold=FALSE,updated_at=CURRENT_TIMESTAMP WHERE container_id=%s", (inspection["container_id"],))
            _audit(cursor, inspection["terminal_id"], user, inspection["container_id"], f"INSPECTION_{event_type}", body.get("notes"), {"inspection_id": inspection_id})
    return jsonify({"event": event, "inspection_status": next_status or inspection["inspection_status"]}), 201
