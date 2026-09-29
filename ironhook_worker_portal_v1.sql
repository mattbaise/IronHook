-- IronHook Worker Self-Service / My IronHook v1
-- Apply after ironhook_container_schema_v1.sql and ironhook_identity_security_v1.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS gang (
    gang_id              BIGSERIAL PRIMARY KEY,
    terminal_id          BIGINT NOT NULL REFERENCES terminal(terminal_id),
    gang_code            VARCHAR(40) NOT NULL,
    gang_name            VARCHAR(120),
    foreman_worker_id    BIGINT REFERENCES worker(worker_id),
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (terminal_id, gang_code)
);

CREATE TABLE IF NOT EXISTS worker_shift_credit (
    worker_shift_credit_id BIGSERIAL PRIMARY KEY,
    worker_id            BIGINT NOT NULL REFERENCES worker(worker_id),
    shift_id             BIGINT NOT NULL REFERENCES work_shift(shift_id),
    gang_id              BIGINT REFERENCES gang(gang_id),
    job_classification   VARCHAR(80) NOT NULL,
    container_hours      NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (container_hours >= 0),
    general_cargo_hours  NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (general_cargo_hours >= 0),
    overtime_hours       NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
    credited_hours       NUMERIC(6,2) NOT NULL CHECK (credited_hours >= 0),
    credit_status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                         CHECK (credit_status IN ('PENDING','APPROVED','ADJUSTED','VOID')),
    notes                TEXT,
    approved_by_user_id  BIGINT REFERENCES app_user(user_id),
    approved_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (worker_id, shift_id)
);

CREATE TABLE IF NOT EXISTS worker_profile_private (
    worker_id            BIGINT PRIMARY KEY REFERENCES worker(worker_id) ON DELETE CASCADE,
    email                VARCHAR(254),
    phone                VARCHAR(40),
    union_status         VARCHAR(40),
    union_join_year      SMALLINT,
    seniority_date       DATE,
    emergency_contact_name VARCHAR(120),
    emergency_contact_phone VARCHAR(40),
    direct_deposit_last4 VARCHAR(4),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worker_certification (
    worker_certification_id BIGSERIAL PRIMARY KEY,
    worker_id            BIGINT NOT NULL REFERENCES worker(worker_id) ON DELETE CASCADE,
    certification_code   VARCHAR(60) NOT NULL,
    certification_name   VARCHAR(160) NOT NULL,
    issued_at            DATE,
    expires_at           DATE,
    status               VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','EXPIRED','SUSPENDED','REVOKED')),
    UNIQUE (worker_id, certification_code)
);

CREATE TABLE IF NOT EXISTS worker_pay_period (
    worker_pay_period_id BIGSERIAL PRIMARY KEY,
    worker_id            BIGINT NOT NULL REFERENCES worker(worker_id),
    period_start         DATE NOT NULL,
    period_end           DATE NOT NULL,
    regular_earnings     NUMERIC(12,2) NOT NULL DEFAULT 0,
    overtime_earnings    NUMERIC(12,2) NOT NULL DEFAULT 0,
    premium_earnings     NUMERIC(12,2) NOT NULL DEFAULT 0,
    gross_earnings       NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_withholding      NUMERIC(12,2) NOT NULL DEFAULT 0,
    union_dues           NUMERIC(12,2) NOT NULL DEFAULT 0,
    benefit_deductions   NUMERIC(12,2) NOT NULL DEFAULT 0,
    retirement_contribution NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_pay              NUMERIC(12,2) NOT NULL DEFAULT 0,
    source_system        VARCHAR(80) NOT NULL DEFAULT 'DEMO',
    finalized            BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (period_end >= period_start),
    UNIQUE (worker_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS worker_hour_adjustment (
    adjustment_id        BIGSERIAL PRIMARY KEY,
    worker_shift_credit_id BIGINT NOT NULL REFERENCES worker_shift_credit(worker_shift_credit_id),
    changed_by_user_id   BIGINT NOT NULL REFERENCES app_user(user_id),
    previous_credited_hours NUMERIC(6,2) NOT NULL,
    new_credited_hours   NUMERIC(6,2) NOT NULL,
    reason               TEXT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worker_shift_credit_worker_shift
    ON worker_shift_credit (worker_id, shift_id DESC);
CREATE INDEX IF NOT EXISTS idx_worker_pay_period_worker_end
    ON worker_pay_period (worker_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_worker_certification_worker_expiry
    ON worker_certification (worker_id, expires_at);

COMMIT;
