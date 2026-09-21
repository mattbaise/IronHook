from werkzeug.security import generate_password_hash
from psycopg.types.json import Jsonb

from db import get_connection


DEMO_PASSWORD = "IronHookDemo!2026"
USERS = (
    ("operator", "Matthew Baise", "OPERATOR", "MB1001"),
    ("supervisor", "Terminal Supervisor", "SUPERVISOR", None),
    ("dispatcher", "Yard Dispatcher", "DISPATCHER", "NC1004"),
    ("security", "Facility Security Officer", "SECURITY", None),
    ("payroll", "HR & Payroll", "HR_PAYROLL", None),
    ("admin", "IronHook Administrator", "ADMIN", None),
)


def seed():
    password_hash = generate_password_hash(DEMO_PASSWORD)
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT terminal_id FROM terminal WHERE terminal_code='BLT-01'")
            terminal_id = cursor.fetchone()["terminal_id"]
            for username, display_name, role, employee_number in USERS:
                cursor.execute("SELECT worker_id FROM worker WHERE employee_number=%s", (employee_number,)) if employee_number else None
                worker = cursor.fetchone() if employee_number else None
                cursor.execute("""INSERT INTO app_user (worker_id,username,password_hash,display_name,role_code,must_change_password)
                    VALUES (%s,%s,%s,%s,%s,FALSE) ON CONFLICT (username) DO UPDATE SET
                    display_name=EXCLUDED.display_name,role_code=EXCLUDED.role_code,active=TRUE RETURNING user_id""",
                    (worker["worker_id"] if worker else None, username, password_hash, display_name, role))
                user_id = cursor.fetchone()["user_id"]
                cursor.execute("""INSERT INTO user_terminal_access (user_id,terminal_id,access_level)
                    VALUES (%s,%s,%s) ON CONFLICT (user_id,terminal_id) DO UPDATE SET access_level=EXCLUDED.access_level""",
                    (user_id, terminal_id, "ADMIN" if role == "ADMIN" else "MANAGER" if role in {"SUPERVISOR","DISPATCHER","SECURITY"} else "STANDARD"))
            cursor.execute("SELECT user_id FROM app_user WHERE username='admin'")
            admin_id = cursor.fetchone()["user_id"]
            cursor.execute("""INSERT INTO terminal_configuration
                (terminal_id,country_code,jurisdiction_code,configuration,security_policy,inspection_policy,updated_by_user_id)
                VALUES (%s,'US','US-DE',%s,%s,%s,%s) ON CONFLICT (terminal_id) DO NOTHING""",
                (terminal_id, Jsonb({"map_name":"BaiseLine Training Terminal","units":"feet"}),
                 Jsonb({"restricted_zones_require_scan":True,"audit_retention_days":2555}),
                 Jsonb({"random_inspection_percent":5,"risk_threshold":65}), admin_id))
            zones = (
                ("BERTH","Vessel Apron","BERTH",180,False,{"x":3,"y":4,"width":94,"height":12}),
                ("IMPORT","Import Yard","CONTAINER",600,False,{"x":5,"y":24,"width":40,"height":28}),
                ("EXPORT","Export Yard","CONTAINER",480,False,{"x":53,"y":24,"width":40,"height":28}),
                ("REEFER","Reefer Yard","REEFER",120,True,{"x":5,"y":60,"width":25,"height":24}),
                ("INSPECT","Inspection Campus","INSPECTION",30,True,{"x":36,"y":60,"width":25,"height":24}),
                ("SECURE","Secure Hold","SECURE_HOLD",24,True,{"x":68,"y":60,"width":25,"height":24}),
            )
            for code,name,kind,capacity,restricted,geometry in zones:
                cursor.execute("""INSERT INTO terminal_zone
                    (terminal_id,zone_code,zone_name,zone_type,capacity_units,restricted,geometry)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (terminal_id,zone_code) DO UPDATE SET
                    zone_name=EXCLUDED.zone_name,zone_type=EXCLUDED.zone_type,capacity_units=EXCLUDED.capacity_units,
                    restricted=EXCLUDED.restricted,geometry=EXCLUDED.geometry RETURNING terminal_zone_id""",
                    (terminal_id,code,name,kind,capacity,restricted,Jsonb(geometry)))
                zone_id = cursor.fetchone()["terminal_zone_id"]
                if kind in {"CONTAINER","REEFER","INSPECTION","SECURE_HOLD"}:
                    for block in (("A",6,20,5),("B",6,20,5)) if kind=="CONTAINER" else ((code[:2],3,8,5),):
                        cursor.execute("""INSERT INTO terminal_yard_block
                            (terminal_zone_id,block_code,block_name,row_count,bay_count,tier_count,rules)
                            VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (terminal_zone_id,block_code) DO NOTHING""",
                            (zone_id,block[0],f"{name} Block {block[0]}",block[1],block[2],block[3],Jsonb({"restricted":restricted,"zone_type":kind})))
            cursor.execute("SELECT worker_id FROM worker WHERE employee_number='MB1001'")
            worker_id = cursor.fetchone()["worker_id"]
            cursor.execute("""INSERT INTO worker_profile_private
                (worker_id,email,phone,union_status,union_join_year,seniority_date,direct_deposit_last4)
                VALUES (%s,'matthew.baise@example.test','302-555-0101','BASIC',2022,'2022-04-01','1027')
                ON CONFLICT (worker_id) DO NOTHING""", (worker_id,))
            cursor.execute("SELECT shift_id FROM work_shift ORDER BY shift_id LIMIT 1")
            shift_id = cursor.fetchone()["shift_id"]
            cursor.execute("""INSERT INTO gang (terminal_id,gang_code,gang_name,foreman_worker_id)
                VALUES (%s,'GANG-12','Yard & Vessel Gang 12',%s) ON CONFLICT (terminal_id,gang_code) DO UPDATE SET gang_name=EXCLUDED.gang_name RETURNING gang_id""", (terminal_id, worker_id))
            gang_id = cursor.fetchone()["gang_id"]
            cursor.execute("""INSERT INTO worker_shift_credit
                (worker_id,shift_id,gang_id,job_classification,container_hours,general_cargo_hours,overtime_hours,credited_hours,credit_status)
                VALUES (%s,%s,%s,'Yard Tractor Operator',5.5,2.5,1,9,'APPROVED') ON CONFLICT (worker_id,shift_id) DO NOTHING""", (worker_id,shift_id,gang_id))
            cursor.execute("""INSERT INTO worker_pay_period
                (worker_id,period_start,period_end,regular_earnings,overtime_earnings,premium_earnings,gross_earnings,tax_withholding,union_dues,benefit_deductions,retirement_contribution,net_pay,finalized)
                VALUES (%s,CURRENT_DATE-14,CURRENT_DATE-1,1840,690,120,2650,503.50,79.50,132.50,159,1775.50,TRUE)
                ON CONFLICT (worker_id,period_start,period_end) DO NOTHING""", (worker_id,))
            cursor.execute("""INSERT INTO worker_document (worker_id,document_type,document_name,issued_at,expires_at,status,external_reference)
                SELECT %s,'IDENTITY','TWIC Card',CURRENT_DATE-365,CURRENT_DATE+730,'CURRENT','DEMO-TWIC-MB1001'
                WHERE NOT EXISTS (SELECT 1 FROM worker_document WHERE worker_id=%s AND document_type='IDENTITY')""", (worker_id,worker_id))
            cursor.execute("""INSERT INTO worker_schedule (worker_id,shift_id,gang_id,scheduled_start,scheduled_end,reporting_location,schedule_status)
                SELECT %s,%s,%s,CURRENT_DATE+INTERVAL '1 day 06 hours',CURRENT_DATE+INTERVAL '1 day 14 hours','Dispatch Hall A','CONFIRMED'
                WHERE NOT EXISTS (SELECT 1 FROM worker_schedule WHERE worker_id=%s AND scheduled_start>CURRENT_TIMESTAMP)""", (worker_id,shift_id,gang_id,worker_id))
    print("Integrated demo data ready")
    print("Demo users: operator, supervisor, dispatcher, security, payroll, admin")
    print(f"Demo password: {DEMO_PASSWORD}")


if __name__ == "__main__":
    seed()
