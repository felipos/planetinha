import { inject, injectable } from 'tsyringe'
import type { Snapshot } from '../domain/snapshot'
import { TOKENS } from './tokens'
import type { SnapshotDataSourcePort } from './ports/snapshot-data-source.port'

/**
 * Orchestrates fetching a Snapshot through the `SnapshotDataSourcePort`, without knowing
 * anything about the backend behind it.
 */
@injectable()
export class FetchSnapshotUseCase {
  constructor(@inject(TOKENS.SnapshotDataSourcePort) private readonly dataSource: SnapshotDataSourcePort) {}

  execute(signal?: AbortSignal): Promise<Snapshot> {
    return this.dataSource.fetchSnapshot(signal)
  }
}
