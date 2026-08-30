import type { TemperatureGrid } from '../domain/temperature-grid'
import type { TemperatureDataSourcePort } from './ports/temperature-data-source-port'

export interface FetchTemperatureGridUseCase {
  execute(signal?: AbortSignal): Promise<TemperatureGrid>
}

/**
 * Orquestra a busca da grade de temperatura através da porta `TemperatureDataSourcePort`,
 * sem conhecer nada sobre o Open-Meteo (ver contracts/temperature-data-source-port.md).
 */
export function createFetchTemperatureGridUseCase(
  dataSource: TemperatureDataSourcePort,
  resolutionDegrees: number,
): FetchTemperatureGridUseCase {
  return {
    execute(signal?: AbortSignal): Promise<TemperatureGrid> {
      return dataSource.fetchGrid({ resolutionDegrees }, signal)
    },
  }
}
