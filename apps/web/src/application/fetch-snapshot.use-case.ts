import { inject, injectable } from 'tsyringe'
import { DEFAULT_GRID_RESOLUTION_DEGREES } from './config'
import type { Snapshot } from '../domain/snapshot'
import { TOKENS } from './tokens'
import type { SnapshotDataSourcePort } from './ports/snapshot-data-source.port'

/**
 * Orchestrates fetching a Snapshot through the `SnapshotDataSourcePort`, without knowing
 * anything about the concrete provider behind it.
 */
@injectable()
export class FetchSnapshotUseCase {
  constructor(@inject(TOKENS.SnapshotDataSourcePort) private readonly dataSource: SnapshotDataSourcePort) {}

  execute(signal?: AbortSignal): Promise<Snapshot> {
    return this.dataSource.fetchSnapshot({ resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES }, signal)
  }
}
