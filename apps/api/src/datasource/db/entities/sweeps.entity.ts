import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import type { SweepStatus } from '../../../domain/models/sweep'

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
