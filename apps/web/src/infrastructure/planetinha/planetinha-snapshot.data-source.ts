import { injectable } from 'tsyringe'
import type { SnapshotDataSourcePort } from '../../application/ports/snapshot-data-source.port'
import type { Snapshot } from '../../domain/snapshot'
import { HttpClient } from '../http-client.service'
import { SnapshotResponseValidator } from './snapshot-response.validator'

/**
 * A relative path in both environments: the dev server proxies it locally, the reverse proxy
 * does in production. There is deliberately no API base URL variable and no CORS configuration
 * anywhere — the browser only ever talks to the origin it was served from.
 */
const SNAPSHOT_PATH = '/api/snapshot'

/**
 * The only `SnapshotDataSourcePort` implementation: it asks Planetinha's own backend for a Snapshot
 * and knows nothing about any weather provider, which is what lets the provider be replaced
 * without touching presentation code.
 *
 * There is no fallback to a weather provider, and that is deliberate rather than an oversight.
 * A client-side fallback sounds like resilience but fires exactly when the backend is
 * unavailable — that is, on every open tab at once — recreating the burst the backend exists to
 * prevent.
 */
@injectable()
export class PlanetinhaSnapshotDataSource implements SnapshotDataSourcePort {
  constructor(private readonly httpClient: HttpClient) {}

  async fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
    const body = await this.httpClient.getJson<unknown>(SNAPSHOT_PATH, { signal })
    return SnapshotResponseValidator.toSnapshot(body)
  }
}
