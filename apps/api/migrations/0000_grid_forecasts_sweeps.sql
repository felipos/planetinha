CREATE TABLE "forecasts" (
	"grid_point_id" integer NOT NULL,
	"valid_at" timestamp with time zone NOT NULL,
	"temperature_celsius" double precision,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "forecasts_grid_point_id_valid_at_pk" PRIMARY KEY("grid_point_id","valid_at")
);
--> statement-breakpoint
CREATE TABLE "grid_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"resolution_degrees" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sweeps" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text NOT NULL,
	"cursor_grid_point_id" integer,
	"total_grid_point_count" integer NOT NULL,
	"fetched_grid_point_count" integer DEFAULT 0 NOT NULL,
	"failed_grid_point_count" integer DEFAULT 0 NOT NULL,
	"upstream_calls_made" integer DEFAULT 0 NOT NULL,
	"rate_limit_hits" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_slice_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_grid_point_id_grid_points_id_fk" FOREIGN KEY ("grid_point_id") REFERENCES "public"."grid_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forecasts_valid_at_idx" ON "forecasts" USING btree ("valid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "grid_points_position_idx" ON "grid_points" USING btree ("latitude","longitude","resolution_degrees");