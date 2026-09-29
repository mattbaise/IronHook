from datetime import date
from decimal import Decimal

from flask import Blueprint, jsonify

from auth import current_user, login_required
from db import get_connection


worker_portal = Blueprint("worker_portal", __name__)


def _json_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def _serialize(row):
    return {key: _json_value(value) for key, value in row.items()}


def _require_worker_identity():
    user = current_user()
    if user is None:
        return None, (jsonify({"error": "Authentication required"}), 401)
    if user.get("worker_id") is None:
        return None, (jsonify({"error": "This account is not linked to a worker profile"}), 403)
    return user, None


@worker_portal.get("/me/overview")
@login_required
def my_overview():
    user, error = _require_worker_identity()
    if error:
        return error

    worker_id = user["worker_id"]
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT w.worker_id, w.employee_number, w.first_name, w.last_name,
                       w.job_classification, w.union_local_code, w.active,
                       p.email, p.phone, p.union_status, p.union_join_year,
                       p.seniority_date, p.emergency_contact_name,
                       p.emergency_contact_phone, p.direct_deposit_last4
                FROM worker w
                LEFT JOIN worker_profile_private p ON p.worker_id = w.worker_id
                WHERE w.worker_id = %s
                """,
                (worker_id,),
            )
            profile = cursor.fetchone()

            cursor.execute(
                """
                SELECT COALESCE(SUM(container_hours),0) AS container_hours,
                       COALESCE(SUM(general_cargo_hours),0) AS general_cargo_hours,
                       COALESCE(SUM(overtime_hours),0) AS overtime_hours,
                       COALESCE(SUM(credited_hours),0) AS credited_hours
                FROM worker_shift_credit
                WHERE worker_id = %s
                  AND credit_status <> 'VOID'
                  AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
                """,
                (worker_id,),
            )
            hours = cursor.fetchone()

            cursor.execute(
                """
                SELECT ws.shift_id, ws.shift_name, ws.starts_at, ws.ends_at,
                       g.gang_code, g.gang_name, c.job_classification,
                       c.container_hours, c.general_cargo_hours,
                       c.overtime_hours, c.credited_hours, c.credit_status
                FROM worker_shift_credit c
                JOIN work_shift ws ON ws.shift_id = c.shift_id
                LEFT JOIN gang g ON g.gang_id = c.gang_id
                WHERE c.worker_id = %s
                ORDER BY ws.starts_at DESC
                LIMIT 25
                """,
                (worker_id,),
            )
            shifts = cursor.fetchall()

            cursor.execute(
                """
                SELECT certification_code, certification_name, issued_at,
                       expires_at, certification_status AS status,
                       issuing_authority, signed_off_by, credential_number,
                       training_hours, notes, TRUE AS is_current
                FROM worker_certification WHERE worker_id = %s
                UNION ALL
                SELECT certification_code, certification_name, issued_at,
                       expires_at, certification_status AS status,
                       issuing_authority, signed_off_by, credential_number,
                       training_hours, notes, FALSE AS is_current
                FROM worker_certification_history WHERE worker_id = %s
                ORDER BY is_current DESC, expires_at DESC NULLS LAST,
                         certification_name
                """,
                (worker_id, worker_id),
            )
            certifications = cursor.fetchall()

    return jsonify({
        "profile": _serialize(profile) if profile else None,
        "hours": _serialize(hours),
        "recent_shifts": [_serialize(row) for row in shifts],
        "certifications": [_serialize(row) for row in certifications],
    })


@worker_portal.get("/me/pay")
@login_required
def my_pay():
    user, error = _require_worker_identity()
    if error:
        return error

    worker_id = user["worker_id"]
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT period_start, period_end, regular_earnings,
                       overtime_earnings, premium_earnings, gross_earnings,
                       tax_withholding, union_dues, benefit_deductions,
                       retirement_contribution, net_pay, source_system, finalized
                FROM worker_pay_period
                WHERE worker_id = %s
                ORDER BY period_end DESC
                LIMIT 26
                """,
                (worker_id,),
            )
            periods = cursor.fetchall()

            cursor.execute(
                """
                SELECT COALESCE(SUM(gross_earnings),0) AS gross_earnings,
                       COALESCE(SUM(net_pay),0) AS net_pay,
                       COALESCE(SUM(tax_withholding),0) AS tax_withholding,
                       COALESCE(SUM(union_dues),0) AS union_dues,
                       COALESCE(SUM(retirement_contribution),0) AS retirement_contribution
                FROM worker_pay_period
                WHERE worker_id = %s
                  AND EXTRACT(YEAR FROM period_end) = EXTRACT(YEAR FROM CURRENT_DATE)
                """,
                (worker_id,),
            )
            ytd = cursor.fetchone()

    return jsonify({
        "ytd": _serialize(ytd),
        "pay_periods": [_serialize(row) for row in periods],
        "notice": "Payroll values are informational and must come from the configured authoritative payroll source in production.",
    })


@worker_portal.get("/me/schedule")
@login_required
def my_schedule():
    user, error = _require_worker_identity()
    if error:
        return error
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """SELECT s.worker_schedule_id,s.scheduled_start,s.scheduled_end,
                          s.reporting_location,s.schedule_status,ws.shift_name,
                          g.gang_code,g.gang_name
                   FROM worker_schedule s
                   LEFT JOIN work_shift ws ON ws.shift_id=s.shift_id
                   LEFT JOIN gang g ON g.gang_id=s.gang_id
                   WHERE s.worker_id=%s AND s.scheduled_end >= CURRENT_TIMESTAMP - INTERVAL '1 day'
                   ORDER BY s.scheduled_start LIMIT 30""",
                (user["worker_id"],),
            )
            schedule = cursor.fetchall()
    return jsonify({"schedule": [_serialize(row) for row in schedule]})


@worker_portal.get("/me/documents")
@login_required
def my_documents():
    user, error = _require_worker_identity()
    if error:
        return error
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """SELECT worker_document_id,document_type,document_name,issued_at,
                          expires_at,status,external_reference
                   FROM worker_document WHERE worker_id=%s
                   ORDER BY expires_at NULLS LAST,document_name""",
                (user["worker_id"],),
            )
            documents = cursor.fetchall()
    return jsonify({"documents": [_serialize(row) for row in documents]})
