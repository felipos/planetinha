import 'reflect-metadata'
import { count } from 'drizzle-orm'
import { container } from 'tsyringe'
import { GRID_RESOLUTION_DEGREES } from '../application/config'
import { GridEnumerator } from '../domain/utils/grid-enumeration'
import { Database } from '../infrastructure/database/database.service'
import { gridPoints } from '../infrastructure/database/schema'

// Seeding is run explicitly, like migrating. Re-running it is safe: the insert conflicts on the
// (latitude, longitude, Resolution) uniqueness of a Grid Point and does nothing, so the Grid is
// never duplicated and existing ids — which a Sweep's cursor refers to — never move.
const database = container.resolve(Database)

try {
  const points = GridEnumerator.enumerate(GRID_RESOLUTION_DEGREES)
  await database.drizzle
    .insert(gridPoints)
    .values([...points])
    .onConflictDoNothing()

  const [row] = await database.drizzle.select({ value: count() }).from(gridPoints)
  console.log(
    `Seeded the Grid at ${GRID_RESOLUTION_DEGREES}° Resolution: ${points.length} Grid Points enumerated, ${row?.value ?? 0} now stored.`,
  )
} finally {
  await database.close()
}
