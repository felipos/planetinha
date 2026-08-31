import type { SweepState } from '../../domain/snapshot'
import type { StoredSnapshotForecast } from '../../domain/utils/snapshot-assembly'

/**
 * Port (dependency-inversion seam) for the read path. The use case knows nothing about SQL,
 * Drizzle, or how the poles are stored — it asks for an hour's worth of Grid Points and gets
 * them back.
 */
export interface SnapshotRepositoryPort {
  /**
   * The hour to serve: `notAfter` itself when it has any Forecast, otherwise the most recent
   * earlier hour that has one, or `null` when no hour has any. Only Grid Points at
   * `resolutionDegrees` are considered, so a Grid reseeded at another Resolution cannot leak in.
   */
  findValidAtToServe(notAfter: Date, resolutionDegrees: number): Promise<Date | null>

  /**
   * Every stored Grid Point at `resolutionDegrees`, each with its Forecast for `validAt` if it
   * has one. Grid Points with No Data come back with a `null` temperature rather than being
   * omitted, so the caller always sees the whole Grid.
   */
  findStoredForecasts(validAt: Date, resolutionDegrees: number): Promise<readonly StoredSnapshotForecast[]>

  /** The most recent Sweep's status, and when a Sweep last completed. */
  findSweepState(): Promise<SweepState>
}
