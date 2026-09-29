-- Complete operator profile and certification history details.
BEGIN;

ALTER TABLE worker_certification
    ADD COLUMN IF NOT EXISTS issuing_authority VARCHAR(160),
    ADD COLUMN IF NOT EXISTS signed_off_by VARCHAR(160),
    ADD COLUMN IF NOT EXISTS credential_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS training_hours NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS worker_certification_history (
    certification_history_id BIGSERIAL PRIMARY KEY,
    worker_id BIGINT NOT NULL REFERENCES worker(worker_id) ON DELETE CASCADE,
    certification_code VARCHAR(60) NOT NULL,
    certification_name VARCHAR(160) NOT NULL,
    issued_at DATE,
    expires_at DATE,
    certification_status VARCHAR(20) NOT NULL
        CHECK (certification_status IN ('EXPIRED','SUSPENDED','REVOKED','REPLACED')),
    issuing_authority VARCHAR(160),
    signed_off_by VARCHAR(160),
    credential_number VARCHAR(100),
    training_hours NUMERIC(6,2),
    notes TEXT,
    UNIQUE (worker_id, certification_code, issued_at)
);

CREATE INDEX IF NOT EXISTS idx_worker_cert_history_worker
    ON worker_certification_history(worker_id, issued_at DESC);

COMMIT;
