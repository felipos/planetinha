import 'reflect-metadata'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { container } from 'tsyringe'
import { Database } from '../datasource/db/database.service'

// Migrations are run explicitly by a human or an agent, never as a side effect of a process
// starting. This script is that explicit step.
const database = container.resolve(Database)
const migrationsFolder = fileURLToPath(new URL('../../migrations', import.meta.url))

try {
  await migrate(database.drizzle, { migrationsFolder })
  console.log('Migrations applied.')
} finally {
  await database.close()
}
