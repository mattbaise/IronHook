-- IronHook configurable terminal + cargo security foundation v1
BEGIN;

CREATE TABLE IF NOT EXISTS terminal_configuration (
    terminal_id BIGINT PRIMARY KEY REFERENCES terminal(terminal_id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL DEFAULT 'US',
    jurisdiction_code VARCHAR(40),
    map_version INTEGER NOT NULL DEFAULT 1,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    security_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    inspection_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by_user_id BIGINT REFERENCES app_user(user_id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terminal_zone (
    terminal_zone_id BIGSERIAL PRIMARY KEY,
    terminal_id BIGINT NOT NULL REFERENCES terminal(terminal_id) ON DELETE CASCADE,
    zone_code VARCHAR(40) NOT NULL,
    zone_name VARCHAR(120) NOT NULL,
    zone_type VARCHAR(30) NOT NULL CHECK (zone_type IN ('CONTAINER','REEFER','HAZARDOUS','EMPTY','GENERAL_CARGO','WAREHOUSE','GATE','ROAD','BERTH','RAIL','INSPECTION','SECURE_HOLD','MAINTENANCE','STAGING','OTHER')),
    geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
    capacity_units INTEGER CHECK (capacity_units IS NULL OR capacity_units >= 0),
    restricted BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (terminal_id, zone_code)
);

CREATE TABLE IF NOT EXISTS cargo_risk_assessment (
    cargo_risk_assessment_id BIGSERIAL PRIMARY KEY,
    container_id BIGINT NOT NULL REFERENCES container(container_id),
    terminal_id BIGINT NOT NULL REFERENCES terminal(terminal_id),
    assessment_version VARCHAR(40) NOT NULL,
    risk_score NUMERIC(6,2) NOT NULL CHECK (risk_score >= 0),
    risk_band VARCHAR(20) NOT NULL CHECK (risk_band IN ('LOW','MODERATE','HIGH','CRITICAL')),
    indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cargo_inspection_selection (
    inspection_selection_id BIGSERIAL PRIMARY KEY,
    container_id BIGINT NOT NULL REFERENCES container(container_id),
    terminal_id BIGINT NOT NULL REFERENCES terminal(terminal_id),
    cargo_risk_assessment_id BIGINT REFERENCES cargo_risk_assessment(cargo_risk_assessment_id),
    selection_method VARCHAR(30) NOT NULL CHECK (selection_method IN ('RISK_BASED','RANDOM','AGENCY_DIRECTIVE','MANUAL_AUTHORIZED')),
    selection_reason_code VARCHAR(80),
    selected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    selected_by_user_id BIGINT REFERENCES app_user(user_id),
    inspection_status VARCHAR(30) NOT NULL DEFAULT 'REQUIRED' CHECK (inspection_status IN ('REQUIRED','IN_PROGRESS','SECONDARY_REQUIRED','CLEARED','HELD','ESCALATED')),
    inspection_zone_id BIGINT REFERENCES terminal_zone(terminal_zone_id),
    cleared_by_user_id BIGINT REFERENCES app_user(user_id),
    cleared_at TIMESTAMPTZ,
    findings JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS security_alert (
    security_alert_id BIGSERIAL PRIMARY KEY,
    terminal_id BIGINT REFERENCES terminal(terminal_id),
    user_id BIGINT REFERENCES app_user(user_id),
    worker_id BIGINT REFERENCES worker(worker_id),
    container_id BIGINT REFERENCES container(container_id),
    alert_type VARCHAR(60) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED','FALSE_POSITIVE')),
    summary TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_risk_container_time ON cargo_risk_assessment(container_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_terminal_status ON cargo_inspection_selection(terminal_id, inspection_status, selected_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alert_terminal_status ON security_alert(terminal_id, status, severity, created_at DESC);

COMMIT;
