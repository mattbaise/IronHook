-- IronHook by BaiseLine
-- Container Movement Schema v1
-- Target database: PostgreSQL

BEGIN;

-- 1. A company may operate one or more terminals.
CREATE TABLE terminal (
    terminal_id         BIGSERIAL PRIMARY KEY,
    terminal_code       VARCHAR(20) NOT NULL UNIQUE,
    terminal_name       VARCHAR(120) NOT NULL,
    timezone_name       VARCHAR(60) NOT NULL DEFAULT 'America/New_York',
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. A vessel visit identifies one vessel call at one terminal.
CREATE TABLE vessel_visit (
    vessel_visit_id     BIGSERIAL PRIMARY KEY,
    terminal_id         BIGINT NOT NULL REFERENCES terminal(terminal_id),
    vessel_name         VARCHAR(120) NOT NULL,
    voyage_number       VARCHAR(40) NOT NULL,
    berth_code          VARCHAR(30),
    scheduled_arrival   TIMESTAMPTZ,
    actual_arrival      TIMESTAMPTZ,
    scheduled_departure TIMESTAMPTZ,
    actual_departure    TIMESTAMPTZ,
    visit_status        VARCHAR(20) NOT NULL DEFAULT 'EXPECTED'
                        CHECK (visit_status IN
                        ('EXPECTED', 'ARRIVED', 'WORKING', 'DEPARTED', 'CANCELLED')),
    UNIQUE (terminal_id, voyage_number)
);

-- 3. Every physical yard position is stored as its own location.
CREATE TABLE yard_location (
    yard_location_id    BIGSERIAL PRIMARY KEY,
    terminal_id         BIGINT NOT NULL REFERENCES terminal(terminal_id),
    zone_code           VARCHAR(30) NOT NULL,
    block_code          VARCHAR(20) NOT NULL,
    row_code            VARCHAR(20) NOT NULL,
    bay_number          INTEGER NOT NULL CHECK (bay_number > 0),
    tier_number         INTEGER NOT NULL CHECK (tier_number > 0),
    location_type       VARCHAR(20) NOT NULL DEFAULT 'STANDARD'
                        CHECK (location_type IN
                        ('STANDARD', 'REEFER', 'HAZARDOUS', 'EMPTY', 'OUT_OF_GAUGE')),
    max_weight_kg       NUMERIC(10, 2),
    is_open             BOOLEAN NOT NULL DEFAULT TRUE,
    is_serviceable      BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (terminal_id, zone_code, block_code, row_code, bay_number, tier_number)
);

-- 4. One row represents one physical shipping container.
CREATE TABLE container (
    container_id        BIGSERIAL PRIMARY KEY,
    container_number    VARCHAR(11) NOT NULL UNIQUE,
    iso_type_code       VARCHAR(10) NOT NULL,
    length_feet         SMALLINT NOT NULL CHECK (length_feet IN (20, 40, 45, 48, 53)),
    gross_weight_kg     NUMERIC(10, 2) CHECK (gross_weight_kg >= 0),
    shipping_line       VARCHAR(80),
    load_status         VARCHAR(10) NOT NULL
                        CHECK (load_status IN ('FULL', 'EMPTY')),
    movement_category   VARCHAR(15) NOT NULL
                        CHECK (movement_category IN
                        ('IMPORT', 'EXPORT', 'TRANSSHIP', 'DOMESTIC')),
    outbound_destination VARCHAR(120),
    current_status      VARCHAR(25) NOT NULL DEFAULT 'EXPECTED'
                        CHECK (current_status IN
                        ('EXPECTED', 'DISCHARGED', 'IN_YARD', 'ON_HOLD',
                         'RELEASED', 'OUTBOUND_STAGED', 'DEPARTED')),
    current_location_id BIGINT REFERENCES yard_location(yard_location_id),
    vessel_visit_id     BIGINT REFERENCES vessel_visit(vessel_visit_id),
    customs_hold        BOOLEAN NOT NULL DEFAULT FALSE,
    security_hold       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Workers are referenced by assignments and container moves.
CREATE TABLE worker (
    worker_id           BIGSERIAL PRIMARY KEY,
    employee_number     VARCHAR(40) NOT NULL UNIQUE,
    first_name          VARCHAR(60) NOT NULL,
    last_name           VARCHAR(60) NOT NULL,
    job_classification  VARCHAR(80) NOT NULL,
    union_local_code    VARCHAR(30),
    active              BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. This table holds cranes, RTGs, top picks, yard trucks and other equipment.
CREATE TABLE equipment (
    equipment_id        BIGSERIAL PRIMARY KEY,
    terminal_id         BIGINT NOT NULL REFERENCES terminal(terminal_id),
    equipment_code      VARCHAR(40) NOT NULL,
    equipment_type      VARCHAR(30) NOT NULL
                        CHECK (equipment_type IN
                        ('STS_CRANE', 'RTG', 'RMG', 'TOP_PICK', 'REACH_STACKER',
                         'YARD_TRUCK', 'CHASSIS', 'FORKLIFT', 'OTHER')),
    operating_status    VARCHAR(20) NOT NULL DEFAULT 'READY'
                        CHECK (operating_status IN
                        ('READY', 'ASSIGNED', 'RESTRICTED', 'DOWN', 'MAINTENANCE')),
    total_operating_hours NUMERIC(12, 1) NOT NULL DEFAULT 0 CHECK (total_operating_hours >= 0),
    total_mileage       NUMERIC(12, 1) NOT NULL DEFAULT 0 CHECK (total_mileage >= 0),
    UNIQUE (terminal_id, equipment_code)
);

-- 7. A shift gives every move a shared operating window.
CREATE TABLE work_shift (
    shift_id            BIGSERIAL PRIMARY KEY,
    terminal_id         BIGINT NOT NULL REFERENCES terminal(terminal_id),
    shift_name          VARCHAR(40) NOT NULL,
    starts_at           TIMESTAMPTZ NOT NULL,
    ends_at             TIMESTAMPTZ NOT NULL,
    shift_status        VARCHAR(15) NOT NULL DEFAULT 'PLANNED'
                        CHECK (shift_status IN ('PLANNED', 'ACTIVE', 'CLOSED')),
    CHECK (ends_at > starts_at)
);

-- 8. A move assignment is the dispatch instruction sent to a worker.
CREATE TABLE move_assignment (
    assignment_id       BIGSERIAL PRIMARY KEY,
    shift_id            BIGINT NOT NULL REFERENCES work_shift(shift_id),
    container_id        BIGINT NOT NULL REFERENCES container(container_id),
    worker_id           BIGINT REFERENCES worker(worker_id),
    equipment_id        BIGINT REFERENCES equipment(equipment_id),
    pickup_location_id  BIGINT REFERENCES yard_location(yard_location_id),
    delivery_location_id BIGINT REFERENCES yard_location(yard_location_id),
    priority_number     INTEGER NOT NULL DEFAULT 100,
    assignment_status   VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
                        CHECK (assignment_status IN
                        ('QUEUED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS',
                         'PAUSED', 'COMPLETED', 'CANCELLED')),
    assigned_at         TIMESTAMPTZ,
    accepted_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    safety_stop         BOOLEAN NOT NULL DEFAULT FALSE,
    exception_reason    TEXT
);

-- 9. This is the permanent movement history. Completed rows are never overwritten.
CREATE TABLE container_move (
    container_move_id   BIGSERIAL PRIMARY KEY,
    container_id        BIGINT NOT NULL REFERENCES container(container_id),
    assignment_id       BIGINT REFERENCES move_assignment(assignment_id),
    shift_id            BIGINT NOT NULL REFERENCES work_shift(shift_id),
    worker_id           BIGINT REFERENCES worker(worker_id),
    equipment_id        BIGINT REFERENCES equipment(equipment_id),
    from_location_id    BIGINT REFERENCES yard_location(yard_location_id),
    to_location_id      BIGINT REFERENCES yard_location(yard_location_id),
    move_type           VARCHAR(25) NOT NULL
                        CHECK (move_type IN
                        ('DISCHARGE', 'YARD_PLACE', 'YARD_REHANDLE',
                         'OUTBOUND_STAGE', 'LOAD_VESSEL', 'GATE_OUT', 'GATE_IN')),
    started_at          TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,
    confirmation_method VARCHAR(20)
                        CHECK (confirmation_method IN
                        ('MANUAL', 'SCAN', 'RFID', 'GPS', 'SYSTEM_IMPORT')),
    source_system       VARCHAR(80) NOT NULL DEFAULT 'IRONHOOK',
    source_reference    VARCHAR(120),
    notes               TEXT,
    CHECK (completed_at IS NULL OR completed_at >= started_at)
);

-- 10. Store every important change for accountability and investigation.
CREATE TABLE audit_event (
    audit_event_id      BIGSERIAL PRIMARY KEY,
    terminal_id         BIGINT REFERENCES terminal(terminal_id),
    worker_id           BIGINT REFERENCES worker(worker_id),
    entity_type         VARCHAR(40) NOT NULL,
    entity_id           BIGINT NOT NULL,
    action_name         VARCHAR(60) NOT NULL,
    reason              TEXT,
    before_data         JSONB,
    after_data          JSONB,
    source_system       VARCHAR(80) NOT NULL DEFAULT 'IRONHOOK',
    happened_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fast lookups used by the Command Center and dispatch screens.
CREATE INDEX idx_container_status
    ON container (current_status);

CREATE INDEX idx_container_location
    ON container (current_location_id);

-- Prevent two active containers from occupying the same physical yard position.
CREATE UNIQUE INDEX uq_active_container_location
    ON container (current_location_id)
    WHERE current_location_id IS NOT NULL
      AND current_status IN ('IN_YARD', 'ON_HOLD', 'RELEASED', 'OUTBOUND_STAGED');

CREATE INDEX idx_assignment_queue
    ON move_assignment (shift_id, assignment_status, priority_number);

CREATE INDEX idx_move_container_time
    ON container_move (container_id, started_at DESC);

CREATE INDEX idx_move_equipment_time
    ON container_move (equipment_id, started_at DESC);

-- Shows every usable yard space and whether a container currently occupies it.
CREATE VIEW live_yard_capacity AS
SELECT
    yl.yard_location_id,
    yl.terminal_id,
    yl.zone_code,
    yl.block_code,
    yl.row_code,
    yl.bay_number,
    yl.tier_number,
    yl.location_type,
    yl.is_open,
    yl.is_serviceable,
    c.container_id,
    c.container_number,
    CASE
        WHEN NOT yl.is_open OR NOT yl.is_serviceable THEN 'UNAVAILABLE'
        WHEN c.container_id IS NOT NULL THEN 'OCCUPIED'
        ELSE 'OPEN'
    END AS occupancy_status
FROM yard_location yl
LEFT JOIN container c
    ON c.current_location_id = yl.yard_location_id
   AND c.current_status IN ('IN_YARD', 'ON_HOLD', 'RELEASED', 'OUTBOUND_STAGED');

-- Gives the Command Center capacity totals by yard block.
CREATE VIEW yard_block_summary AS
SELECT
    terminal_id,
    zone_code,
    block_code,
    COUNT(*) FILTER (WHERE occupancy_status = 'OCCUPIED') AS occupied_spaces,
    COUNT(*) FILTER (WHERE occupancy_status = 'OPEN') AS open_spaces,
    COUNT(*) FILTER (WHERE occupancy_status = 'UNAVAILABLE') AS unavailable_spaces,
    COUNT(*) AS total_spaces,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE occupancy_status = 'OCCUPIED')
        / NULLIF(COUNT(*) FILTER (WHERE occupancy_status <> 'UNAVAILABLE'), 0),
        1
    ) AS usable_occupancy_percent
FROM live_yard_capacity
GROUP BY terminal_id, zone_code, block_code;

COMMIT;
