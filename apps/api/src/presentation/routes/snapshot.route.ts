import type { FastifyInstance } from 'fastify'
import type { GetSnapshotUseCase } from '../../domain/usecases/get-snapshot.usecase'
import type { Snapshot } from '../../domain/models/snapshot'
import type { SweepStatus } from '../../domain/models/sweep'

/**
 * The wire contract with the frontend, stated in the domain's vocabulary so that reading a
 * response teaches the domain. It is duplicated by hand on the consuming side rather than
 * shared through a package, with a validator there to catch drift.
 *
 * Note what is deliberately absent: there is no Snapshot-level Fetched At. A Snapshot is
 * assembled per hour from whatever Forecasts exist and may hold rows written by different
 * Sweeps, so a single response-level fetch time would be a lie. Fetched At is per Forecast.
 */
export interface SnapshotForecastBody {
  readonly latitude: number
  readonly longitude: number
  /** `null` is No Data — never zero, which is a real temperature. */
  readonly temperatureCelsius: number | null
  readonly fetchedAt: string | null
}

export interface SnapshotBody {
  readonly validAt: string
  readonly resolutionDegrees: number
  readonly coverage: { readonly total: number; readonly withData: number }
  readonly sweep: { readonly status: SweepStatus | null; readonly completedAt: string | null }
  readonly forecasts: readonly SnapshotForecastBody[]
}

export class SnapshotRoute {
  static register(app: FastifyInstance, getSnapshotUseCase: GetSnapshotUseCase): void {
    app.get('/api/snapshot', async (): Promise<SnapshotBody> => {
      return SnapshotRoute.toBody(await getSnapshotUseCase.execute())
    })
  }

  private static toBody(snapshot: Snapshot): SnapshotBody {
    return {
      validAt: snapshot.validAt.toISOString(),
      resolutionDegrees: snapshot.resolutionDegrees,
      coverage: snapshot.coverage,
      sweep: {
        status: snapshot.sweep.status,
        completedAt: snapshot.sweep.completedAt?.toISOString() ?? null,
      },
      forecasts: snapshot.forecasts.map((forecast) => ({
        latitude: forecast.latitude,
        longitude: forecast.longitude,
        temperatureCelsius: forecast.temperatureCelsius,
        fetchedAt: forecast.fetchedAt?.toISOString() ?? null,
      })),
    }
  }
}
