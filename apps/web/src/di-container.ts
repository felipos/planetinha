import { container } from 'tsyringe'
import { TOKENS } from './application/tokens'
import { PlanetinhaSnapshotDataSource } from './infrastructure/planetinha/planetinha-snapshot.data-source'

/**
 * Composition root's DI wiring: the only place that decides which concrete
 * `SnapshotDataSourcePort` implementation is registered against its token. Everything else
 * (use cases, presentation) only ever depends on the port.
 *
 * There is one implementation and no mode switch. The weather provider adapter and the mock
 * adapter were both deleted: the browser talks to Planetinha's backend or to nothing at all.
 */
export class DiContainer {
  static setup(): void {
    container.registerSingleton(TOKENS.SnapshotDataSourcePort, PlanetinhaSnapshotDataSource)
  }
}
