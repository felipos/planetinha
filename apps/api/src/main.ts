import 'reflect-metadata'
import { container } from 'tsyringe'
import { CheckHealthUseCase } from './domain/usecases/check-health.usecase'
import { GetSnapshotUseCase } from './domain/usecases/get-snapshot.usecase'
import { DiContainer } from './di-container'
import { DatabaseReadiness } from './datasource/db/database-readiness.service'
import { Env } from './core/env.service'
import { Server } from './server'

// Composition root: the only file that resolves from the container. Everything else receives
// its dependencies as constructor arguments or parameters.
DiContainer.setup()

// Fail fast, before binding a port: the api must never serve against a database that was never
// migrated or a Grid that was never seeded.
try {
  await container.resolve(DatabaseReadiness).verify()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const app = Server.build(
  {
    checkHealthUseCase: container.resolve(CheckHealthUseCase),
    getSnapshotUseCase: container.resolve(GetSnapshotUseCase),
  },
  { logger: true },
)

try {
  await app.listen({ port: Env.PORT, host: Env.HOST })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
