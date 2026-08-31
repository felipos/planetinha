import { inject, injectable } from 'tsyringe'
import { DEFAULT_GRID_RESOLUTION_DEGREES } from './config'
import type { TemperatureGrid } from '../domain/temperature-grid'
import { TOKENS } from './tokens'
import type { TemperatureDataSourcePort } from './ports/temperature-data-source.port'

/**
 * Orchestrates fetching the temperature grid through the `TemperatureDataSourcePort`, without
 * knowing anything about the concrete provider behind it.
 */
@injectable()
export class FetchTemperatureGridUseCase {
  constructor(
    @inject(TOKENS.TemperatureDataSourcePort) private readonly dataSource: TemperatureDataSourcePort,
  ) {}

  execute(signal?: AbortSignal): Promise<TemperatureGrid> {
    return this.dataSource.fetchGrid({ resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES }, signal)
  }
}
