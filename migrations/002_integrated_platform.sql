-- IronHook integrated platform migration v2
-- Apply after the v1 container, credential, identity, worker portal and terminal files.

BEGIN;

CREATE TABLE IF NOT EXISTS terminal_yard_block (
    yard_block_id       BIGSERIAL PRIMARY KEY,
    terminal_zone_id    BIGINT NOT NULL REFERENCES terminal_zone(terminal_zone_id) ON DELETE CASCADE,
    block_code          VARCHAR(30) NOT NULL,
    block_name          VARCHAR(120),
    row_count           INTEGER NOT NULL CHECK (row_count BETWEEN 1 AND 100),
    bay_count           INTEGER NOT NULL CHECK (bay_count BETWEEN 1 AND 500),
    tier_count          INTEGER NOT NULL CHECK (tier_count BETWEEN 1 AND 12),
    slot_length_feet    SMALLINT NOT NULL DEFAULT 40 CHECK (slot_length_feet IN (20, 40, 45, 48, 53)),
    max_weight_kg       NUMERIC(10,2),
    rules               JSONB NOT NULL DEFAULT '{}'::jsonb,
    geometry            JSONB NOT NULL DEFAULT '{}'::jsonb,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (terminal_zone_id, block_code)
);

CREATE TABLE IF NOT EXISTS worker_document (
    worker_document_id  BIGSERIAL PRIMARY KEY,
    worker_id           BIGINT NOT NULL REFERENCES worker(worker_id) ON DELETE CASCADE,
    document_type       VARCHAR(60) NOT NULL,
    document_name       VARCHAR(180) NOT NULL,
    issued_at           DATE,
    expires_at          DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'CURRENT'
                        CHECK (status IN ('CURRENT','EXPIRING','EXPIRED','REPLACED')),
    external_reference  VARCHAR(240),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worker_schedule (
    worker_schedule_id  BIGSERIAL PRIMARY KEY,
    worker_id           BIGINT NOT NULL REFERENCES worker(worker_id) ON DELETE CASCADE,
    shift_id            BIGINT REFERENCES work_shift(shift_id) ON DELETE SET NULL,
    gang_id             BIGINT REFERENCES gang(gang_id) ON DELETE SET NULL,
    scheduled_start     TIMESTAMPTZ NOT NULL,
    scheduled_end       TIMESTAMPTZ NOT NULL,
    reporting_location  VARCHAR(160),
    schedule_status     VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
                        CHECK (schedule_status IN ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED')),
    CHECK (scheduled_end > scheduled_start)
);

CREATE TABLE IF NOT EXISTS cargo_inspection_event (
    inspection_event_id BIGSERIAL PRIMARY KEY,
    inspection_selection_id BIGINT NOT NULL REFERENCES cargo_inspection_selection(inspection_selection_id) ON DELETE CASCADE,
    event_type          VARCHAR(30) NOT NULL
                        CHECK (event_type IN ('SELECTED','HOLD_PLACED','STARTED','CUSTODY_TRANSFER','FINDING','SECONDARY_REQUIRED','CLEARED','HELD','ESCALATED','DISPOSITION')),
    from_custodian      VARCHAR(160),
    to_custodian        VARCHAR(160),
    location_label      VARCHAR(160),
    seal_number         VARCHAR(80),
    notes               TEXT,
    evidence            JSONB NOT NULL DEFAULT '{}'::jsonb,
    performed_by_user_id BIGINT NOT NULL REFERENCES app_user(user_id),
    happened_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE cargo_inspection_selection
    ADD COLUMN IF NOT EXISTS disposition VARCHAR(40),
    ADD COLUMN IF NOT EXISTS disposition_notes TEXT,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_yard_block_zone ON terminal_yard_block(terminal_zone_id, active);
CREATE INDEX IF NOT EXISTS idx_worker_document_worker ON worker_document(worker_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_worker_schedule_worker_start ON worker_schedule(worker_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_inspection_event_selection_time ON cargo_inspection_event(inspection_selection_id, happened_at);

COMMIT;
