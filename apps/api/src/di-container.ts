import { container } from 'tsyringe'
import type { SweepConfig } from './application/sweep-config'
import { TOKENS } from './application/tokens'
import { SnapshotRepository } from './infrastructure/database/snapshot.repository'
import { SweepRepository } from './infrastructure/database/sweep.repository'
import { Env } from './infrastructure/env.service'
import { OpenMeteoForecastDataSource } from './infrastructure/open-meteo/open-meteo-forecast.data-source'
import { PinoLogger } from './infrastructure/pino-logger.service'

/**
 * Composition root's DI wiring: the only place allowed to call `container.register*`. Concrete
 * classes (`Clock`, `Database`, use cases) need no registration at all — tsyringe resolves them
 * directly from the decorator metadata emitted for their constructor. Only a port, whose
 * interface has no runtime representation, needs a token registered against an implementation.
 *
 * This is also the only place that reads the environment into the pacing configuration, so a
 * use case depends on the values rather than on where they came from.
 */
export class DiContainer {
  static setup(): void {
    container.registerSingleton(TOKENS.SnapshotRepositoryPort, SnapshotRepository)
    container.registerSingleton(TOKENS.SweepRepositoryPort, SweepRepository)
    container.registerSingleton(TOKENS.ForecastSourcePort, OpenMeteoForecastDataSource)
    container.registerSingleton(TOKENS.LoggerPort, PinoLogger)

    const sweepConfig: SweepConfig = {
      sliceSize: Env.SLICE_SIZE,
      sweepIntervalMs: Env.SWEEP_INTERVAL_MS,
    }
    container.register(TOKENS.SweepConfig, { useValue: sweepConfig })
  }
}
