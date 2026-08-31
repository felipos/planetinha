import { container } from 'tsyringe'
import { TOKENS } from './application/tokens'
import { MockTemperatureDataSource } from './infrastructure/mock/mock-temperature.data-source'
import { OpenMeteoTemperatureDataSource } from './infrastructure/open-meteo/open-meteo-temperature.data-source'

/**
 * Composition root's DI wiring: the only place that decides which concrete
 * `SnapshotDataSourcePort` implementation is registered against its token. Everything else
 * (use cases, presentation) only ever depends on the port.
 */
export class DiContainer {
  static setup(): void {
    if (import.meta.env.MODE === 'mock') {
      container.registerSingleton(TOKENS.SnapshotDataSourcePort, MockTemperatureDataSource)
    } else {
      container.registerSingleton(TOKENS.SnapshotDataSourcePort, OpenMeteoTemperatureDataSource)
    }
  }
}
