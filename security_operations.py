import hashlib
import json

from flask import Blueprint, jsonify, request

from auth import current_user, roles_required
from db import get_connection


security_operations = Blueprint("security_operations", __name__)


def _clamp(value, low=0, high=100):
    return max(low, min(high, value))


def _deterministic_roll(container_number, salt):
    digest = hashlib.sha256(f"{container_number}:{salt}".encode()).hexdigest()
    return int(digest[:8], 16) % 10000 / 100


def _risk_score(body):
    """Transparent demo scoring; production weights must be approved by compliance/security."""
    score = 0
    factors = []
    country_risk = _clamp(int(body.get("country_risk", 0)))
    route_risk = _clamp(int(body.get("route_risk", 0)))
    shipper_risk = _clamp(int(body.get("shipper_risk", 0)))
    anomaly_risk = _clamp(int(body.get("anomaly_risk", 0)))
    score = round(
        country_risk * 0.30 + route_risk * 0.25 +
        shipper_risk * 0.20 + anomaly_risk * 0.25
    )
    if country_risk:
        factors.append({"factor": "country_or_area", "score": country_risk})
    if route_risk:
        factors.append({"factor": "route", "score": route_risk})
    if shipper_risk:
        factors.append({"factor": "shipper", "score": shipper_risk})
    if anomaly_risk:
        factors.append({"factor": "data_or_manifest_anomaly", "score": anomaly_risk})
    return score, factors


@security_operations.post("/containers/<int:container_id>/assess")
@roles_required("SECURITY", "SUPERVISOR", "ADMIN")
def assess_container(container_id):
    body = request.get_json(silent=True) or {}
    user = current_user()
    score, factors = _risk_score(body)
    random_rate = _clamp(int(body.get("random_inspection_percent", 5)), 0, 100)
    threshold = _clamp(int(body.get("risk_threshold", 65)), 0, 100)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT container_id, container_number FROM container WHERE container_id = %s",
                (container_id,),
            )
            container = cursor.fetchone()
            if container is None:
                return jsonify({"error": "Container not found"}), 404

            roll = _deterministic_roll(container["container_number"], body.get("selection_salt", "IRONHOOK-DEMO"))
            risk_selected = score >= threshold
            random_selected = roll < random_rate
            selected = risk_selected or random_selected
            selection_reason = None
            if risk_selected:
                selection_reason = "RISK_BASED"
            elif random_selected:
                selection_reason = "RANDOMIZED"

            cursor.execute(
                """
                INSERT INTO cargo_risk_assessment (
                    container_id, risk_score, risk_level, factors, assessed_by_user_id
                ) VALUES (%s,%s,%s,%s,%s)
                RETURNING risk_assessment_id, assessed_at
                """,
                (
                    container_id,
                    score,
                    "HIGH" if score >= 75 else "MEDIUM" if score >= 40 else "LOW",
                    json.dumps(factors),
                    user["user_id"],
                ),
            )
            assessment = cursor.fetchone()

            inspection = None
            if selected:
                cursor.execute(
                    """
                    INSERT INTO cargo_inspection_selection (
                        container_id, risk_assessment_id, selection_method,
                        selection_reason, status, selected_by_user_id
                    ) VALUES (%s,%s,%s,%s,'SELECTED',%s)
                    RETURNING inspection_selection_id, status, selected_at
                    """,
                    (
                        container_id,
                        assessment["risk_assessment_id"],
                        selection_reason,
                        "Risk threshold met" if risk_selected else "Random inspection selection",
                        user["user_id"],
                    ),
                )
                inspection = cursor.fetchone()
                cursor.execute(
                    "UPDATE container SET security_hold = TRUE WHERE container_id = %s",
                    (container_id,),
                )

    return jsonify({
        "container_id": container_id,
        "risk_score": score,
        "factors": factors,
        "random_roll": roll,
        "selected_for_inspection": selected,
        "selection_method": selection_reason,
        "assessment": assessment,
        "inspection": inspection,
    })


@security_operations.get("/inspections")
@roles_required("SECURITY", "SUPERVISOR", "ADMIN")
def list_inspections():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT s.*, c.container_number
                FROM cargo_inspection_selection s
                JOIN container c ON c.container_id = s.container_id
                ORDER BY s.selected_at DESC
                LIMIT 200
                """
            )
            rows = cursor.fetchall()
    return jsonify({"count": len(rows), "inspections": rows})
