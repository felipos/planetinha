import type { ForecastsDbDataSource } from '../../src/datasource/db/forecasts.db.datasource'
import { GridEnumerator } from '../../src/domain/utils/grid-enumeration'
import type { StoredSnapshotForecast } from '../../src/domain/utils/snapshot-assembly'

export interface FakeForecastsDataSourceOptions {
  /** Stored Forecasts keyed by the ISO Valid At hour they describe. */
  readonly forecastsByValidAt?: ReadonlyMap<string, readonly StoredSnapshotForecast[]>
}

/**
 * A `ForecastsDbDataSource` backed by an in-memory map instead of Postgres. It answers with the
 * stored Grid — poles present once — so the expansion the api does stays under test.
 */
export function createFakeForecastsDataSource(
  options: FakeForecastsDataSourceOptions = {},
): ForecastsDbDataSource {
  const forecastsByValidAt = options.forecastsByValidAt ?? new Map()

  return {
    async findValidAtToServe(notAfter: Date): Promise<Date | null> {
      const candidates = [...forecastsByValidAt.keys()]
        .map((iso) => new Date(iso))
        .filter((validAt) => validAt.getTime() <= notAfter.getTime())
        .sort((a, b) => b.getTime() - a.getTime())
      return candidates[0] ?? null
    },

    async findStoredForecasts(validAt: Date): Promise<readonly StoredSnapshotForecast[]> {
      const stored = forecastsByValidAt.get(validAt.toISOString())
      if (stored !== undefined) {
        return stored
      }
      // No Forecast for this hour: every Grid Point still comes back, with No Data.
      return storedGrid(() => null)
    },
  } as unknown as ForecastsDbDataSource
}

/**
 * The stored Grid — each pole once, as the database holds it — with `temperature(point)`
 * deciding each Grid Point's temperature. Returning `null` means No Data for that Grid Point.
 */
export function storedGrid(
  temperature: (point: { latitude: number; longitude: number }) => number | null,
  fetchedAt = new Date('2026-08-31T09:12:00.000Z'),
): readonly StoredSnapshotForecast[] {
  return GridEnumerator.enumerate().map((point) => {
    const temperatureCelsius = temperature(point)
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      temperatureCelsius,
      fetchedAt: temperatureCelsius === null ? null : fetchedAt,
    }
  })
}
