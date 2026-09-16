-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('PARTICIPANT', 'VOLUNTEER', 'ADMIN');

-- CreateEnum
CREATE TYPE "participant_status" AS ENUM ('REGISTERED', 'ACTIVE', 'DISQUALIFIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "lobby_type" AS ENUM ('PRELIMINARY', 'FINAL');

-- CreateEnum
CREATE TYPE "lobby_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "round_type" AS ENUM ('PRACTICE', 'PRELIMINARY', 'FINAL');

-- CreateEnum
CREATE TYPE "round_status" AS ENUM ('UPCOMING', 'ACTIVE', 'SCORING', 'COMPLETED', 'LOCKED');

-- CreateEnum
CREATE TYPE "player_role" AS ENUM ('CREWMATE', 'IMPOSTER');

-- CreateEnum
CREATE TYPE "rule_role" AS ENUM ('CREWMATE', 'IMPOSTER', 'ANY');

-- CreateEnum
CREATE TYPE "rule_field_type" AS ENUM ('BOOLEAN', 'INTEGER');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('NOT_STARTED', 'REGISTRATION', 'BRIEFING', 'PRACTICE', 'PRELIMINARY', 'RESULTS', 'FINAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "tie_break_method" AS ENUM ('ADMIN_DECISION', 'FINAL_ROUND_SCORE', 'HEAD_TO_HEAD', 'ALL_QUALIFY');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "participant_id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "among_us_username" VARCHAR(50),
    "lobby_id" UUID,
    "status" "participant_status" NOT NULL DEFAULT 'REGISTERED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_assignments" (
    "id" UUID NOT NULL,
    "volunteer_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "lobby_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lobbies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" "lobby_type" NOT NULL DEFAULT 'PRELIMINARY',
    "capacity" INTEGER,
    "status" "lobby_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lobbies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "round_number" INTEGER NOT NULL,
    "type" "round_type" NOT NULL,
    "status" "round_status" NOT NULL DEFAULT 'UPCOMING',
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "score_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_participants" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "lobby_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_entries" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "role" "player_role" NOT NULL,
    "correct_vote" BOOLEAN NOT NULL DEFAULT false,
    "correct_identification" BOOLEAN NOT NULL DEFAULT false,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "survived" BOOLEAN NOT NULL DEFAULT false,
    "won_as_crewmate" BOOLEAN NOT NULL DEFAULT false,
    "won_as_imposter" BOOLEAN NOT NULL DEFAULT false,
    "successful_elimination" INTEGER NOT NULL DEFAULT 0,
    "avoided_identification" BOOLEAN NOT NULL DEFAULT false,
    "voted_out_as_imposter" BOOLEAN NOT NULL DEFAULT false,
    "total_score" INTEGER NOT NULL,
    "entered_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "score_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_history" (
    "id" UUID NOT NULL,
    "score_entry_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "old_total_score" INTEGER,
    "new_total_score" INTEGER NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB NOT NULL,
    "changed_by" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rules" (
    "id" UUID NOT NULL,
    "rule_key" VARCHAR(50) NOT NULL,
    "rule_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "applicable_role" "rule_role" NOT NULL DEFAULT 'ANY',
    "field_type" "rule_field_type" NOT NULL DEFAULT 'BOOLEAN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "preliminary_score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "is_tie_at_cutoff" BOOLEAN NOT NULL DEFAULT false,
    "admin_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_settings" (
    "id" UUID NOT NULL,
    "event_name" VARCHAR(200) NOT NULL DEFAULT 'AMONG US: LIVE DEDUCTION',
    "event_description" TEXT,
    "event_date" DATE,
    "event_status" "event_status" NOT NULL DEFAULT 'NOT_STARTED',
    "venue" VARCHAR(200),
    "event_start" VARCHAR(10) DEFAULT '09:00',
    "event_end" VARCHAR(10) DEFAULT '12:00',
    "qualification_count" INTEGER NOT NULL DEFAULT 8,
    "final_score_formula" VARCHAR(50),
    "preliminary_weight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "final_weight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "results_published" BOOLEAN NOT NULL DEFAULT false,
    "results_locked" BOOLEAN NOT NULL DEFAULT false,
    "tie_break_method" "tie_break_method" NOT NULL DEFAULT 'ADMIN_DECISION',
    "max_eliminations_per_round" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_items" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "participants_user_id_key" ON "participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_participant_id_key" ON "participants"("participant_id");

-- CreateIndex
CREATE INDEX "participants_lobby_id_idx" ON "participants"("lobby_id");

-- CreateIndex
CREATE INDEX "participants_status_idx" ON "participants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_user_id_key" ON "volunteers"("user_id");

-- CreateIndex
CREATE INDEX "volunteer_assignments_volunteer_id_idx" ON "volunteer_assignments"("volunteer_id");

-- CreateIndex
CREATE INDEX "volunteer_assignments_round_id_idx" ON "volunteer_assignments"("round_id");

-- CreateIndex
CREATE INDEX "volunteer_assignments_lobby_id_idx" ON "volunteer_assignments"("lobby_id");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_assignments_volunteer_id_round_id_lobby_id_key" ON "volunteer_assignments"("volunteer_id", "round_id", "lobby_id");

-- CreateIndex
CREATE UNIQUE INDEX "lobbies_name_key" ON "lobbies"("name");

-- CreateIndex
CREATE INDEX "lobbies_type_idx" ON "lobbies"("type");

-- CreateIndex
CREATE INDEX "rounds_type_idx" ON "rounds"("type");

-- CreateIndex
CREATE INDEX "rounds_status_idx" ON "rounds"("status");

-- CreateIndex
CREATE INDEX "rounds_is_archived_idx" ON "rounds"("is_archived");

-- CreateIndex
CREATE INDEX "round_participants_round_id_idx" ON "round_participants"("round_id");

-- CreateIndex
CREATE INDEX "round_participants_participant_id_idx" ON "round_participants"("participant_id");

-- CreateIndex
CREATE INDEX "round_participants_lobby_id_idx" ON "round_participants"("lobby_id");

-- CreateIndex
CREATE UNIQUE INDEX "round_participants_round_id_participant_id_key" ON "round_participants"("round_id", "participant_id");

-- CreateIndex
CREATE INDEX "score_entries_round_id_idx" ON "score_entries"("round_id");

-- CreateIndex
CREATE INDEX "score_entries_participant_id_idx" ON "score_entries"("participant_id");

-- CreateIndex
CREATE INDEX "score_entries_entered_by_idx" ON "score_entries"("entered_by");

-- CreateIndex
CREATE UNIQUE INDEX "score_entries_round_id_participant_id_key" ON "score_entries"("round_id", "participant_id");

-- CreateIndex
CREATE INDEX "score_history_score_entry_id_idx" ON "score_history"("score_entry_id");

-- CreateIndex
CREATE INDEX "score_history_changed_by_idx" ON "score_history"("changed_by");

-- CreateIndex
CREATE INDEX "score_history_created_at_idx" ON "score_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rules_rule_key_key" ON "scoring_rules"("rule_key");

-- CreateIndex
CREATE INDEX "scoring_rules_is_active_idx" ON "scoring_rules"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "qualifications_participant_id_key" ON "qualifications"("participant_id");

-- CreateIndex
CREATE INDEX "qualifications_qualified_idx" ON "qualifications"("qualified");

-- CreateIndex
CREATE INDEX "qualifications_rank_idx" ON "qualifications"("rank");

-- CreateIndex
CREATE INDEX "announcements_is_active_idx" ON "announcements"("is_active");

-- CreateIndex
CREATE INDEX "announcements_created_at_idx" ON "announcements"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_items_sort_order_key" ON "schedule_items"("sort_order");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_lobby_id_fkey" FOREIGN KEY ("lobby_id") REFERENCES "lobbies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_lobby_id_fkey" FOREIGN KEY ("lobby_id") REFERENCES "lobbies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_participants" ADD CONSTRAINT "round_participants_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_participants" ADD CONSTRAINT "round_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_participants" ADD CONSTRAINT "round_participants_lobby_id_fkey" FOREIGN KEY ("lobby_id") REFERENCES "lobbies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_score_entry_id_fkey" FOREIGN KEY ("score_entry_id") REFERENCES "score_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
