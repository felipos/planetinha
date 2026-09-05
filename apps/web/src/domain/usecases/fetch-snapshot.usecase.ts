import { injectable } from 'tsyringe'
import type { Snapshot } from '../models/snapshot'
import { PlanetinhaHttpDataSource } from '../../datasource/http/planetinha.http.datasource'

/**
 * Orchestrates fetching a Snapshot through the `PlanetinhaHttpDataSource`, without knowing
 * anything about `fetch`, URLs, or the JSON shape behind it.
 */
@injectable()
export class FetchSnapshotUseCase {
  constructor(private readonly dataSource: PlanetinhaHttpDataSource) {}

  execute(signal?: AbortSignal): Promise<Snapshot> {
    return this.dataSource.fetchSnapshot(signal)
  }
}
