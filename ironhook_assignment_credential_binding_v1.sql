-- IronHook V2
-- Bind a granted credential scan to the assignment that consumes it.

ALTER TABLE credential_scan_event
    ADD COLUMN consumed_at TIMESTAMPTZ,
    ADD COLUMN consumed_by_assignment_id BIGINT
        REFERENCES move_assignment(assignment_id);

ALTER TABLE credential_scan_event
    ADD CONSTRAINT credential_scan_event_consumption_pair_check
    CHECK (
        (
            consumed_at IS NULL
            AND consumed_by_assignment_id IS NULL
        )
        OR
        (
            consumed_at IS NOT NULL
            AND consumed_by_assignment_id IS NOT NULL
        )
    );

CREATE INDEX idx_credential_scan_event_consumed_assignment
    ON credential_scan_event(consumed_by_assignment_id)
    WHERE consumed_by_assignment_id IS NOT NULL;
