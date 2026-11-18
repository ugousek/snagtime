ALTER TABLE "EventType" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BookingOccupancy" ADD COLUMN "seat" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "BookingOccupancy_workspaceId_hostId_minuteStart_key";
CREATE UNIQUE INDEX "BookingOccupancy_workspaceId_hostId_minuteStart_seat_key" ON "BookingOccupancy"("workspaceId", "hostId", "minuteStart", "seat");
