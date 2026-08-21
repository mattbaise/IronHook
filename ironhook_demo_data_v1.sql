-- IronHook by BaiseLine
-- Demo Terminal and Container Movement Data v1
-- Run AFTER ironhook_container_schema_v1.sql

BEGIN;

INSERT INTO terminal (terminal_code, terminal_name)
VALUES ('BLT-01', 'BaiseLine Training Terminal');

INSERT INTO vessel_visit (
    terminal_id, vessel_name, voyage_number, berth_code,
    scheduled_arrival, actual_arrival, scheduled_departure, visit_status
)
VALUES (
    (SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'),
    'Atlantic Star', 'AS-0821', 'BERTH-1',
    '2026-08-21 05:30:00-04', '2026-08-21 05:42:00-04',
    '2026-08-21 18:00:00-04', 'WORKING'
);

-- Eight example positions: standard, reefer, hazardous and outbound staging.
INSERT INTO yard_location (
    terminal_id, zone_code, block_code, row_code, bay_number, tier_number,
    location_type, max_weight_kg, is_open, is_serviceable
)
VALUES
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'IMPORT', 'A', '01', 1, 1, 'STANDARD', 35000, TRUE, TRUE),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'IMPORT', 'A', '01', 1, 2, 'STANDARD', 30000, TRUE, TRUE),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'IMPORT', 'B', '02', 4, 1, 'STANDARD', 35000, TRUE, TRUE),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'EXPORT', 'C', '04', 12, 1, 'STANDARD', 35000, TRUE, TRUE),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'REEFER', 'R', '02', 3, 1, 'REEFER', 35000, TRUE, TRUE),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'HAZARD', 'H', '01', 2, 1, 'HAZARDOUS', 35000, TRUE, TRUE),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'OUTBOUND', 'STAGE', '03', 1, 1, 'STANDARD', 35000, TRUE, TRUE),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'IMPORT', 'B', '02', 5, 1, 'STANDARD', 35000, FALSE, TRUE);

INSERT INTO worker (
    employee_number, first_name, last_name, job_classification, union_local_code
)
VALUES
('MB1001', 'Matthew', 'Baise', 'Yard Tractor Operator', 'LOCAL-000'),
('JR1002', 'Jordan', 'Rivera', 'Crane Operator', 'LOCAL-000'),
('SG1003', 'Simone', 'Grant', 'Top Pick Operator', 'LOCAL-000'),
('NC1004', 'Noah', 'Coleman', 'Dispatcher', 'LOCAL-000');

INSERT INTO equipment (
    terminal_id, equipment_code, equipment_type, operating_status,
    total_operating_hours, total_mileage
)
VALUES
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'C-01', 'STS_CRANE', 'ASSIGNED', 12480.5, 0),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'RTG-01', 'RTG', 'READY', 8420.2, 0),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'TP-02', 'TOP_PICK', 'ASSIGNED', 6931.8, 0),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'TRUCK-24', 'YARD_TRUCK', 'ASSIGNED', 5104.6, 48320.7),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'CH-108', 'CHASSIS', 'ASSIGNED', 0, 128440.3),
((SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'), 'TRUCK-17', 'YARD_TRUCK', 'DOWN', 7821.4, 69102.9);

INSERT INTO work_shift (
    terminal_id, shift_name, starts_at, ends_at, shift_status
)
VALUES (
    (SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'),
    'Day Shift', '2026-08-21 06:00:00-04', '2026-08-21 14:00:00-04', 'ACTIVE'
);

-- Five containers demonstrate different points in the lifecycle.
INSERT INTO container (
    container_number, iso_type_code, length_feet, gross_weight_kg,
    shipping_line, load_status, movement_category, outbound_destination,
    current_status, current_location_id, vessel_visit_id,
    customs_hold, security_hold
)
VALUES
(
    'MSCU1234567', '42G1', 40, 24100, 'MSC', 'FULL', 'IMPORT', 'Philadelphia, PA',
    'DEPARTED', NULL,
    (SELECT vessel_visit_id FROM vessel_visit WHERE voyage_number = 'AS-0821'),
    FALSE, FALSE
),
(
    'MAEU4812073', '45R1', 40, 27750, 'Maersk', 'FULL', 'IMPORT', 'Newark, NJ',
    'IN_YARD',
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'REEFER' AND block_code = 'R' AND row_code = '02'
       AND bay_number = 3 AND tier_number = 1),
    (SELECT vessel_visit_id FROM vessel_visit WHERE voyage_number = 'AS-0821'),
    FALSE, FALSE
),
(
    'TGHU7654321', '22G1', 20, 18400, 'Hapag-Lloyd', 'FULL', 'IMPORT', 'Baltimore, MD',
    'ON_HOLD',
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'HAZARD' AND block_code = 'H' AND row_code = '01'
       AND bay_number = 2 AND tier_number = 1),
    (SELECT vessel_visit_id FROM vessel_visit WHERE voyage_number = 'AS-0821'),
    TRUE, FALSE
),
(
    'CMAU2468101', '42G1', 40, 22300, 'CMA CGM', 'FULL', 'EXPORT', 'Rotterdam, NL',
    'RELEASED',
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'EXPORT' AND block_code = 'C' AND row_code = '04'
       AND bay_number = 12 AND tier_number = 1),
    (SELECT vessel_visit_id FROM vessel_visit WHERE voyage_number = 'AS-0821'),
    FALSE, FALSE
),
(
    'OOLU1122334', '22G1', 20, 9600, 'OOCL', 'FULL', 'IMPORT', 'Wilmington, DE',
    'EXPECTED', NULL,
    (SELECT vessel_visit_id FROM vessel_visit WHERE voyage_number = 'AS-0821'),
    FALSE, FALSE
);

-- A completed yard-to-gate assignment for MSCU1234567.
INSERT INTO move_assignment (
    shift_id, container_id, worker_id, equipment_id,
    pickup_location_id, delivery_location_id, priority_number,
    assignment_status, assigned_at, accepted_at, completed_at
)
VALUES (
    (SELECT shift_id FROM work_shift WHERE shift_name = 'Day Shift'),
    (SELECT container_id FROM container WHERE container_number = 'MSCU1234567'),
    (SELECT worker_id FROM worker WHERE employee_number = 'MB1001'),
    (SELECT equipment_id FROM equipment WHERE equipment_code = 'TRUCK-24'),
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'IMPORT' AND block_code = 'A' AND row_code = '01'
       AND bay_number = 1 AND tier_number = 1),
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'OUTBOUND' AND block_code = 'STAGE' AND row_code = '03'
       AND bay_number = 1 AND tier_number = 1),
    10, 'COMPLETED',
    '2026-08-21 07:40:00-04', '2026-08-21 07:42:00-04', '2026-08-21 07:58:00-04'
);

-- A queued outbound assignment for CMAU2468101.
INSERT INTO move_assignment (
    shift_id, container_id, worker_id, equipment_id,
    pickup_location_id, delivery_location_id, priority_number,
    assignment_status, assigned_at
)
VALUES (
    (SELECT shift_id FROM work_shift WHERE shift_name = 'Day Shift'),
    (SELECT container_id FROM container WHERE container_number = 'CMAU2468101'),
    (SELECT worker_id FROM worker WHERE employee_number = 'MB1001'),
    (SELECT equipment_id FROM equipment WHERE equipment_code = 'TRUCK-24'),
    (SELECT current_location_id FROM container WHERE container_number = 'CMAU2468101'),
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'OUTBOUND' AND block_code = 'STAGE' AND row_code = '03'
       AND bay_number = 1 AND tier_number = 1),
    20, 'ASSIGNED', '2026-08-21 10:38:00-04'
);

-- Permanent movement history for one container from vessel to departure.
INSERT INTO container_move (
    container_id, shift_id, worker_id, equipment_id,
    from_location_id, to_location_id, move_type,
    started_at, completed_at, confirmation_method, source_system, source_reference
)
VALUES
(
    (SELECT container_id FROM container WHERE container_number = 'MSCU1234567'),
    (SELECT shift_id FROM work_shift WHERE shift_name = 'Day Shift'),
    (SELECT worker_id FROM worker WHERE employee_number = 'JR1002'),
    (SELECT equipment_id FROM equipment WHERE equipment_code = 'C-01'),
    NULL,
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'IMPORT' AND block_code = 'A' AND row_code = '01'
       AND bay_number = 1 AND tier_number = 1),
    'DISCHARGE', '2026-08-21 06:22:00-04', '2026-08-21 06:25:00-04',
    'SCAN', 'IRONHOOK', 'MOVE-AS0821-001'
),
(
    (SELECT container_id FROM container WHERE container_number = 'MSCU1234567'),
    (SELECT shift_id FROM work_shift WHERE shift_name = 'Day Shift'),
    (SELECT worker_id FROM worker WHERE employee_number = 'MB1001'),
    (SELECT equipment_id FROM equipment WHERE equipment_code = 'TRUCK-24'),
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'IMPORT' AND block_code = 'A' AND row_code = '01'
       AND bay_number = 1 AND tier_number = 1),
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'OUTBOUND' AND block_code = 'STAGE' AND row_code = '03'
       AND bay_number = 1 AND tier_number = 1),
    'OUTBOUND_STAGE', '2026-08-21 07:42:00-04', '2026-08-21 07:52:00-04',
    'SCAN', 'IRONHOOK', 'MOVE-AS0821-002'
),
(
    (SELECT container_id FROM container WHERE container_number = 'MSCU1234567'),
    (SELECT shift_id FROM work_shift WHERE shift_name = 'Day Shift'),
    (SELECT worker_id FROM worker WHERE employee_number = 'MB1001'),
    (SELECT equipment_id FROM equipment WHERE equipment_code = 'TRUCK-24'),
    (SELECT yard_location_id FROM yard_location
     WHERE zone_code = 'OUTBOUND' AND block_code = 'STAGE' AND row_code = '03'
       AND bay_number = 1 AND tier_number = 1),
    NULL, 'GATE_OUT', '2026-08-21 07:53:00-04', '2026-08-21 07:58:00-04',
    'SCAN', 'IRONHOOK', 'GATE-OUT-0087'
);

INSERT INTO audit_event (
    terminal_id, worker_id, entity_type, entity_id,
    action_name, reason, after_data, source_system, happened_at
)
VALUES (
    (SELECT terminal_id FROM terminal WHERE terminal_code = 'BLT-01'),
    (SELECT worker_id FROM worker WHERE employee_number = 'MB1001'),
    'CONTAINER',
    (SELECT container_id FROM container WHERE container_number = 'MSCU1234567'),
    'GATE_OUT_CONFIRMED',
    'Container identity and outbound release verified at gate',
    '{"status":"DEPARTED","gate_reference":"GATE-OUT-0087"}'::JSONB,
    'IRONHOOK', '2026-08-21 07:58:00-04'
);

COMMIT;

