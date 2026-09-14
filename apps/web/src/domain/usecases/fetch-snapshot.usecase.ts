import { injectable } from 'tsyringe'
import type { Snapshot } from '../models/snapshot'
import { ForecastHttpDataSource } from '../../datasource/http/forecast.http.datasource'

/**
 * Orchestrates fetching a Snapshot through the `ForecastHttpDataSource`, without knowing
 * anything about `fetch`, URLs, or the JSON shape behind it.
 */
@injectable()
export class FetchSnapshotUseCase {
  constructor(private readonly dataSource: ForecastHttpDataSource) {}

  execute(signal?: AbortSignal): Promise<Snapshot> {
    return this.dataSource.fetchSnapshot(signal)
  }
}
