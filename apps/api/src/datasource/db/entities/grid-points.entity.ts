import { doublePrecision, pgTable, serial, uniqueIndex } from 'drizzle-orm/pg-core'

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
