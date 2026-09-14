import { doublePrecision, pgTable, serial, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * The Grid, materialised. Nothing recomputes Grid Points at runtime; this table is the source
 * of truth, and a Sweep's cursor is an id from it. The Grid has a single Resolution
 * (`GRID_RESOLUTION_DEGREES`) for the foreseeable future, so it is a code constant rather than a
 * column — see `0006-resolution-is-a-code-constant-not-stored-data.md`.
 */
export const gridPoints = pgTable(
  'grid_points',
  {
    id: serial('id').primaryKey(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
  },
  (table) => [uniqueIndex('grid_points_position_idx').on(table.latitude, table.longitude)],
)
