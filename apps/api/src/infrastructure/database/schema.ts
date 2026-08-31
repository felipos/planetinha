import {
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { SweepStatus } from '../../domain/sweep'

/**
 * The Grid, materialised. Nothing recomputes Grid Points at runtime; this table is the source
 * of truth, and a Sweep's cursor is an id from it. `resolution_degrees` is stored per row so
 * that a reseed at a different Resolution cannot silently produce a Snapshot mixing two
 * lattices.
 */
export const gridPoints = pgTable(
  'grid_points',
  {
    id: serial('id').primaryKey(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    resolutionDegrees: doublePrecision('resolution_degrees').notNull(),
  },
  (table) => [
    uniqueIndex('grid_points_position_idx').on(table.latitude, table.longitude, table.resolutionDegrees),
  ],
)

/**
 * Forecasts, keyed by (Grid Point, Valid At) so that an upsert is idempotent: a replayed Slice
 * is harmless and a later Sweep's fresher Forecast overwrites an overlapping hour.
 *
 * `temperature_celsius` is nullable — null is No Data, never zero. The index on `valid_at` is
 * required from the start: the read path filters by a single hour and this table grows without
 * bound (roughly 60,500 new rows a day, with nothing pruning them yet).
 */
export const forecasts = pgTable(
  'forecasts',
  {
    gridPointId: integer('grid_point_id')
      .notNull()
      .references(() => gridPoints.id, { onDelete: 'cascade' }),
    validAt: timestamp('valid_at', { withTimezone: true }).notNull(),
    temperatureCelsius: doublePrecision('temperature_celsius'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gridPointId, table.validAt] }),
    index('forecasts_valid_at_idx').on(table.validAt),
  ],
)

/** One row per Sweep rather than one mutable row, so the history of call counts and Rate Limit
 * hits survives. */
export const sweeps = pgTable('sweeps', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status').$type<SweepStatus>().notNull(),
  cursorGridPointId: integer('cursor_grid_point_id'),
  totalGridPointCount: integer('total_grid_point_count').notNull(),
  fetchedGridPointCount: integer('fetched_grid_point_count').notNull().default(0),
  failedGridPointCount: integer('failed_grid_point_count').notNull().default(0),
  upstreamCallsMade: integer('upstream_calls_made').notNull().default(0),
  rateLimitHits: integer('rate_limit_hits').notNull().default(0),
  lastError: text('last_error'),
  lastSliceAt: timestamp('last_slice_at', { withTimezone: true }),
})
