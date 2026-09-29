-- IronHook Identity & Security Foundation v1
-- Apply after ironhook_container_schema_v1.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS app_user (
    user_id             BIGSERIAL PRIMARY KEY,
    worker_id           BIGINT UNIQUE REFERENCES worker(worker_id),
    username            VARCHAR(80) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    display_name        VARCHAR(120) NOT NULL,
    role_code           VARCHAR(30) NOT NULL
                        CHECK (role_code IN (
                            'OPERATOR',
                            'SUPERVISOR',
                            'DISPATCHER',
                            'SECURITY',
                            'HR_PAYROLL',
                            'ADMIN'
                        )),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_count  INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_terminal_access (
    user_id             BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    terminal_id         BIGINT NOT NULL REFERENCES terminal(terminal_id) ON DELETE CASCADE,
    access_level        VARCHAR(20) NOT NULL DEFAULT 'STANDARD'
                        CHECK (access_level IN ('READ_ONLY', 'STANDARD', 'MANAGER', 'ADMIN')),
    PRIMARY KEY (user_id, terminal_id)
);

CREATE TABLE IF NOT EXISTS auth_security_event (
    security_event_id   BIGSERIAL PRIMARY KEY,
    user_id             BIGINT REFERENCES app_user(user_id),
    username_attempted  VARCHAR(80),
    event_type          VARCHAR(40) NOT NULL,
    outcome             VARCHAR(20) NOT NULL
                        CHECK (outcome IN ('SUCCESS', 'DENIED', 'BLOCKED', 'ERROR')),
    ip_address          INET,
    user_agent          TEXT,
    details             JSONB,
    happened_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_user_role
    ON app_user (role_code, active);

CREATE INDEX IF NOT EXISTS idx_auth_security_event_user_time
    ON auth_security_event (user_id, happened_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_security_event_type_time
    ON auth_security_event (event_type, happened_at DESC);

COMMIT;
