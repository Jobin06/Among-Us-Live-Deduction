-- Immutability Function and Triggers

CREATE OR REPLACE FUNCTION fn_prevent_immutable_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'IMMUTABLE TABLE VIOLATION: % operations are not permitted on table "%" — this table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for audit_logs
CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_immutable_modification();

CREATE TRIGGER trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_immutable_modification();

-- Triggers for score_history
CREATE TRIGGER trg_score_history_no_update
    BEFORE UPDATE ON score_history
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_immutable_modification();

CREATE TRIGGER trg_score_history_no_delete
    BEFORE DELETE ON score_history
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_immutable_modification();

-- Database-level check constraints
ALTER TABLE score_entries ADD CONSTRAINT chk_tasks_completed_non_negative CHECK (tasks_completed >= 0);
ALTER TABLE score_entries ADD CONSTRAINT chk_successful_elimination_non_negative CHECK (successful_elimination >= 0);
ALTER TABLE event_settings ADD CONSTRAINT chk_qualification_count_positive CHECK (qualification_count > 0);
ALTER TABLE event_settings ADD CONSTRAINT chk_preliminary_weight_positive CHECK (preliminary_weight > 0);
ALTER TABLE event_settings ADD CONSTRAINT chk_final_weight_positive CHECK (final_weight > 0);
ALTER TABLE event_settings ADD CONSTRAINT chk_max_eliminations_positive CHECK (max_eliminations_per_round IS NULL OR max_eliminations_per_round > 0);

-- Partial unique index for active rounds (allows archived rounds to reuse numbers)
CREATE UNIQUE INDEX uq_rounds_type_number_active ON rounds(type, round_number) WHERE is_archived = false;