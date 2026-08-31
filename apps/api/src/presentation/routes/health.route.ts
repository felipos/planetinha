import type { FastifyInstance } from 'fastify'
import type { CheckHealthUseCase } from '../../application/check-health.use-case'

/**
 * Routes are the api's presentation layer: they translate an HTTP request into a use-case call
 * and its result into a response body, and hold no logic of their own. A use case is passed in
 * rather than resolved here, so a route can be exercised with a fake one and no container.
 */
export class HealthRoute {
  static register(app: FastifyInstance, checkHealthUseCase: CheckHealthUseCase): void {
    app.get('/health', async () => checkHealthUseCase.execute())
  }
}
