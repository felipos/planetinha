import { count } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import { Database } from '../../datasource/db/database.service'
import { gridPoints } from '../../datasource/db/entities/schema'

/** Postgres reports a query against a table that does not exist as `undefined_table`. */
const UNDEFINED_TABLE = '42P01'

/**
 * The driver's error carries the SQLSTATE code, but the query builder wraps it in an error of
 * its own whose message is only the failed SQL — so the code is found by walking the cause
 * chain rather than by reading the top-level error.
 */
function isUndefinedTable(error: unknown): boolean {
  for (let current: unknown = error; current !== undefined && current !== null;) {
    if (typeof current !== 'object') {
      return false
    }
    if ((current as { code?: string }).code === UNDEFINED_TABLE) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

/**
 * Fails a process at boot when the database is not ready for it, with an instruction naming the
 * step that was skipped. Migrating and seeding are deliberately manual — no process does either
 * as a side effect of starting — so a forgotten step is expected, and it must produce something
 * an operator can act on rather than a stack trace from the first real query.
 *
 * Boot-only and never wired to an HTTP route, unlike `CheckHealthUseCase`: a liveness probe has
 * to stay cheap enough to call every few seconds, and a database round trip on every call would
 * defeat that.
 */
@injectable()
export class VerifyDatabaseReadinessUseCase {
  constructor(private readonly database: Database) {}

  async execute(): Promise<void> {
    let gridPointCount: number
    try {
      const [row] = await this.database.drizzle.select({ value: count() }).from(gridPoints)
      gridPointCount = row?.value ?? 0
    } catch (error) {
      if (isUndefinedTable(error)) {
        throw new Error(
          'The database schema is missing. Run `npm run db:migrate --workspace @planetinha/api` from the host before starting this process.',
        )
      }
      throw error
    }

    if (gridPointCount === 0) {
      throw new Error(
        'The Grid has not been seeded, so there are no Grid Points to sweep or serve. Run `npm run db:seed --workspace @planetinha/api` from the host before starting this process.',
      )
    }
  }
}
