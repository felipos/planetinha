import Fastify, { type FastifyInstance } from 'fastify'
import type { CheckHealthUseCase } from './application/check-health.use-case'
import { HealthRoute } from './presentation/routes/health.route'

export interface ServerDependencies {
  readonly checkHealthUseCase: CheckHealthUseCase
}

/**
 * Builds the Fastify instance without listening on a port, so a test can inject requests into
 * the real routes in-process. Binding a port is the entrypoint's job, not this one's.
 */
export class Server {
  static build(
    dependencies: ServerDependencies,
    options: { readonly logger?: boolean } = {},
  ): FastifyInstance {
    const app = Fastify({ logger: options.logger ?? false })
    HealthRoute.register(app, dependencies.checkHealthUseCase)
    return app
  }
}
