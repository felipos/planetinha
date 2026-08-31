import 'reflect-metadata'
import { container } from 'tsyringe'
import { CheckHealthUseCase } from './application/check-health.use-case'
import { DiContainer } from './di-container'
import { Env } from './infrastructure/env.service'
import { Server } from './server'

// Composition root: the only file that resolves from the container. Everything else receives
// its dependencies as constructor arguments or parameters.
DiContainer.setup()

const app = Server.build({ checkHealthUseCase: container.resolve(CheckHealthUseCase) }, { logger: true })

try {
  await app.listen({ port: Env.PORT, host: Env.HOST })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
