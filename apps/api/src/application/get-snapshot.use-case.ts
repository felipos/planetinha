import { inject, injectable } from 'tsyringe'
import type { Snapshot } from '../domain/snapshot'
import { Hours } from '../domain/utils/hours'
import { SnapshotAssembler } from '../domain/utils/snapshot-assembly'
import { Clock } from '../infrastructure/clock.service'
import { GRID_RESOLUTION_DEGREES } from './config'
import type { SnapshotRepositoryPort } from './ports/snapshot-repository.port'
import { TOKENS } from './tokens'

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
    @inject(TOKENS.SnapshotRepositoryPort) private readonly repository: SnapshotRepositoryPort,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<Snapshot> {
    const currentHour = Hours.floor(this.clock.now())
    const validAt =
      (await this.repository.findValidAtToServe(currentHour, GRID_RESOLUTION_DEGREES)) ?? currentHour

    const [stored, sweep] = await Promise.all([
      this.repository.findStoredForecasts(validAt, GRID_RESOLUTION_DEGREES),
      this.repository.findSweepState(),
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
