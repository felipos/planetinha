import { doublePrecision, index, integer, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core'
import { gridPoints } from './grid-points.entity'

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
