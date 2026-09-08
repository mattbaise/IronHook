BEGIN;

-- ---------------------------------------------------------
-- Worker union profile
-- ---------------------------------------------------------

ALTER TABLE worker
    ADD COLUMN IF NOT EXISTS union_status VARCHAR(25),
    ADD COLUMN IF NOT EXISTS union_join_year SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'worker_union_status_check'
    ) THEN
        ALTER TABLE worker
            ADD CONSTRAINT worker_union_status_check
            CHECK (
                union_status IS NULL
                OR union_status IN (
                    'CASUAL',
                    'SECONDARY',
                    'BASIC'
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'worker_union_join_year_check'
    ) THEN
        ALTER TABLE worker
            ADD CONSTRAINT worker_union_join_year_check
            CHECK (
                union_join_year IS NULL
                OR union_join_year BETWEEN 1900 AND 2100
            );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- Digital worker credential
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS worker_credential (
    credential_id       BIGSERIAL PRIMARY KEY,
    worker_id           BIGINT NOT NULL UNIQUE
                        REFERENCES worker(worker_id)
                        ON DELETE CASCADE,

    credential_code     VARCHAR(60) NOT NULL UNIQUE,

    credential_status   VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (
                            credential_status IN (
                                'ACTIVE',
                                'SUSPENDED',
                                'EXPIRED',
                                'REVOKED'
                            )
                        ),

    qr_token_hash       VARCHAR(255),

    issued_at           TIMESTAMPTZ NOT NULL
                        DEFAULT CURRENT_TIMESTAMP,

    expires_at          TIMESTAMPTZ,

    last_rotated_at     TIMESTAMPTZ,

    CHECK (
        expires_at IS NULL
        OR expires_at > issued_at
    )
);


-- ---------------------------------------------------------
-- Worker certifications / qualifications
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS worker_certification (
    certification_id    BIGSERIAL PRIMARY KEY,

    worker_id           BIGINT NOT NULL
                        REFERENCES worker(worker_id)
                        ON DELETE CASCADE,

    certification_code  VARCHAR(50) NOT NULL,

    certification_name  VARCHAR(120) NOT NULL,

    issued_at           DATE,

    expires_at          DATE,

    certification_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (
                            certification_status IN (
                                'ACTIVE',
                                'SUSPENDED',
                                'REVOKED'
                            )
                        ),

    CHECK (
        expires_at IS NULL
        OR issued_at IS NULL
        OR expires_at >= issued_at
    ),

    UNIQUE (
        worker_id,
        certification_code
    )
);


-- ---------------------------------------------------------
-- Credential scan audit trail
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS credential_scan_event (
    scan_event_id       BIGSERIAL PRIMARY KEY,

    credential_id       BIGINT NOT NULL
                        REFERENCES worker_credential(
                            credential_id
                        )
                        ON DELETE CASCADE,

    terminal_id         BIGINT
                        REFERENCES terminal(terminal_id),

    scan_type           VARCHAR(30) NOT NULL
                        CHECK (
                            scan_type IN (
                                'BADGE_IN',
                                'HIRE_SELECTION',
                                'EQUIPMENT_ASSIGNMENT',
                                'GATE_ACCESS',
                                'BADGE_OUT'
                            )
                        ),

    scan_result         VARCHAR(15) NOT NULL
                        CHECK (
                            scan_result IN (
                                'GRANTED',
                                'DENIED'
                            )
                        ),

    device_code         VARCHAR(60),

    location_label      VARCHAR(120),

    scanned_at          TIMESTAMPTZ NOT NULL
                        DEFAULT CURRENT_TIMESTAMP,

    details             JSONB NOT NULL DEFAULT '{}'::jsonb
);


-- ---------------------------------------------------------
-- Demo union profile
-- ---------------------------------------------------------

UPDATE worker
SET
    union_status = 'BASIC',
    union_join_year = 2022
WHERE employee_number = 'MB1001';

UPDATE worker
SET
    union_status = 'BASIC',
    union_join_year = 2018
WHERE employee_number = 'JR1002';

UPDATE worker
SET
    union_status = 'SECONDARY',
    union_join_year = 2024
WHERE employee_number = 'SG1003';

UPDATE worker
SET
    union_status = 'CASUAL',
    union_join_year = 2026
WHERE employee_number = 'NC1004';


-- ---------------------------------------------------------
-- Demo digital credentials
-- ---------------------------------------------------------

INSERT INTO worker_credential (
    worker_id,
    credential_code,
    credential_status
)
VALUES
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'MB1001'
    ),
    'IH-W-MB1001',
    'ACTIVE'
),
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'JR1002'
    ),
    'IH-W-JR1002',
    'ACTIVE'
),
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'SG1003'
    ),
    'IH-W-SG1003',
    'ACTIVE'
),
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'NC1004'
    ),
    'IH-W-NC1004',
    'ACTIVE'
)
ON CONFLICT (worker_id) DO NOTHING;


-- ---------------------------------------------------------
-- Demo certifications
-- ---------------------------------------------------------

INSERT INTO worker_certification (
    worker_id,
    certification_code,
    certification_name,
    issued_at,
    expires_at
)
VALUES
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'MB1001'
    ),
    'YARD-TRACTOR',
    'Yard Tractor Operator',
    '2026-01-10',
    '2027-01-10'
),
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'MB1001'
    ),
    'PORT-SAFETY',
    'Terminal Safety Certification',
    '2026-02-15',
    '2027-02-15'
),
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'JR1002'
    ),
    'STS-CRANE',
    'Ship-to-Shore Crane Operator',
    '2025-11-01',
    '2026-11-01'
),
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'SG1003'
    ),
    'TOP-PICK',
    'Top Pick Operator',
    '2026-03-20',
    '2027-03-20'
),
(
    (
        SELECT worker_id
        FROM worker
        WHERE employee_number = 'NC1004'
    ),
    'DISPATCH',
    'Terminal Dispatch Qualification',
    '2026-05-01',
    '2027-05-01'
)
ON CONFLICT (
    worker_id,
    certification_code
) DO NOTHING;

COMMIT;
