DROP INDEX "grid_points_position_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "grid_points_position_idx" ON "grid_points" USING btree ("latitude","longitude");--> statement-breakpoint
ALTER TABLE "grid_points" DROP COLUMN "resolution_degrees";