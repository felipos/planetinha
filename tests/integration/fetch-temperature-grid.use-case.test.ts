import { describe, expect, it } from 'vitest'
import { DEFAULT_GRID_RESOLUTION_DEGREES } from '../../src/application/config'
import { FetchTemperatureGridUseCase } from '../../src/application/fetch-temperature-grid.use-case'
import type {
  TemperatureDataSourcePort,
  TemperatureGridRequest,
} from '../../src/application/ports/temperature-data-source.port'
import type { TemperatureGrid } from '../../src/domain/temperature-grid'

function createFakeDataSource(
  behavior: (request: TemperatureGridRequest) => Promise<TemperatureGrid>,
): TemperatureDataSourcePort {
  return { fetchGrid: behavior }
}

describe('FetchTemperatureGridUseCase', () => {
  it('delegates to the data source port with the configured resolution (success path)', async () => {
    const grid: TemperatureGrid = {
      readings: [{ latitude: 0, longitude: 0, temperatureCelsius: 21, observedAt: '2026-01-01T00:00' }],
      fetchedAt: '2026-01-01T00:00:00Z',
      resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES,
      expectedPointCount: 1,
    }
    let receivedRequest: TemperatureGridRequest | undefined
    const dataSource = createFakeDataSource(async (request) => {
      receivedRequest = request
      return grid
    })

    const useCase = new FetchTemperatureGridUseCase(dataSource)
    const result = await useCase.execute()

    expect(result).toBe(grid)
    expect(receivedRequest).toEqual({ resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES })
  })

  it('propagates a rejection from the data source (error path — never fails silently)', async () => {
    const dataSource = createFakeDataSource(async () => {
      throw new Error('Open-Meteo indisponível')
    })
    const useCase = new FetchTemperatureGridUseCase(dataSource)

    await expect(useCase.execute()).rejects.toThrow('Open-Meteo indisponível')
  })

  it('resolves again after a prior failure (stale-error → success retry path)', async () => {
    let callCount = 0
    const grid: TemperatureGrid = {
      readings: [],
      fetchedAt: '2026-01-01T00:00:00Z',
      resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES,
      expectedPointCount: 0,
    }
    const dataSource = createFakeDataSource(async () => {
      callCount += 1
      if (callCount === 1) {
        throw new Error('timeout')
      }
      return grid
    })
    const useCase = new FetchTemperatureGridUseCase(dataSource)

    await expect(useCase.execute()).rejects.toThrow('timeout')
    await expect(useCase.execute()).resolves.toBe(grid)
  })
})
