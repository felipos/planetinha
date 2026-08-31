import { container } from 'tsyringe'
import { TOKENS } from './application/tokens'
import { SnapshotRepository } from './infrastructure/database/snapshot.repository'

/**
 * Composition root's DI wiring: the only place allowed to call `container.register*`. Concrete
 * classes (`Clock`, `Database`, use cases) need no registration at all — tsyringe resolves them
 * directly from the decorator metadata emitted for their constructor. Only a port, whose
 * interface has no runtime representation, needs a token registered against an implementation.
 */
export class DiContainer {
  static setup(): void {
    container.registerSingleton(TOKENS.SnapshotRepositoryPort, SnapshotRepository)
  }
}
