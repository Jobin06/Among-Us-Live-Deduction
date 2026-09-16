-- AlterTable
ALTER TABLE "event_settings" ADD COLUMN "is_singleton" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "event_settings_is_singleton_key" ON "event_settings"("is_singleton");

-- Enforce that is_singleton can ONLY ever be true, guaranteeing a single row
ALTER TABLE "event_settings" ADD CONSTRAINT "chk_event_settings_is_singleton" CHECK (is_singleton = true);
