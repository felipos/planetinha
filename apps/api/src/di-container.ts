import { container } from 'tsyringe'
import { Database } from './datasource/db/database.service'
import { Logger } from './core/logger.service'

/**
 * Composition root's DI wiring: the only place allowed to call `container.register*`. Every
 * class-typed dependency resolves on its own from the decorator metadata emitted for its
 * constructor — this file exists only for the two things that must stay a single shared
 * instance rather than a fresh one per resolve: the one Postgres connection the process uses,
 * and the one Pino instance every log line goes through.
 */
export class DiContainer {
  static setup(): void {
    container.registerSingleton(Database)
    container.registerSingleton(Logger)
  }
}
