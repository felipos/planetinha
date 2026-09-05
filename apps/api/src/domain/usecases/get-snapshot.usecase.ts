import { injectable } from 'tsyringe'
import type { Snapshot } from '../models/snapshot'
import { Hours } from '../utils/hours'
import { SnapshotAssembler } from '../utils/snapshot-assembly'
import { Clock } from '../../core/clock.service'
import { GRID_RESOLUTION_DEGREES } from '../../core/config'
import { ForecastsDbDataSource } from '../../datasource/db/forecasts.db.datasource'
import { SweepsDbDataSource } from '../../datasource/db/sweeps.db.datasource'

/**
 * Assembles the Snapshot for the hour a caller should be shown.
 *
 * Before the first Sweep completes there is nothing to fall back to, and that is not an error:
 * the current hour is served with every temperature `null` and Coverage at zero. An empty Grid
 * is the limiting case of partial Coverage.
 */
@injectable()
export class GetSnapshotUseCase {
  constructor(
    private readonly forecastsDataSource: ForecastsDbDataSource,
    private readonly sweepsDataSource: SweepsDbDataSource,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<Snapshot> {
    const currentHour = Hours.floor(this.clock.now())
    const validAt =
      (await this.forecastsDataSource.findValidAtToServe(currentHour, GRID_RESOLUTION_DEGREES)) ?? currentHour

    const [stored, sweep] = await Promise.all([
      this.forecastsDataSource.findStoredForecasts(validAt, GRID_RESOLUTION_DEGREES),
      this.sweepsDataSource.findSweepState(),
    ])

    const forecasts = SnapshotAssembler.expand(stored, GRID_RESOLUTION_DEGREES)

    return {
      validAt,
      resolutionDegrees: GRID_RESOLUTION_DEGREES,
      coverage: SnapshotAssembler.coverageOf(forecasts, GRID_RESOLUTION_DEGREES),
      sweep,
      forecasts,
    }
  }
}
