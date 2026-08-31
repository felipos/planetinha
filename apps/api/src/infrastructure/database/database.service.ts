import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { injectable } from 'tsyringe'
import { Env } from '../env.service'
import * as schema from './schema'

/**
 * The single Postgres connection this process uses. Injected as a concrete class so that
 * repositories never build a connection of their own, and so the entrypoint has one thing to
 * close on shutdown.
 */
@injectable()
export class Database {
  private readonly client = postgres(Env.DATABASE_URL)

  readonly drizzle: PostgresJsDatabase<typeof schema> = drizzle({ client: this.client, schema })

  close(): Promise<void> {
    return this.client.end()
  }
}
