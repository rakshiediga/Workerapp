-- Preserve the optional explanation alongside the existing transition actor.
ALTER TABLE "BookingStatusHistory" ADD COLUMN "reason" VARCHAR(500);
