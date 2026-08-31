import type { Snapshot } from '../../domain/snapshot'

/**
 * Port (dependency-inversion seam) between the use-case layer and the data-source layer. Use
 * cases know nothing about `fetch`, URLs, the JSON shape of a specific provider, batching, or
 * CORS — they only call `fetchSnapshot()`.
 */
export interface SnapshotRequest {
  readonly resolutionDegrees: number
}

export interface SnapshotDataSourcePort {
  /**
   * `signal`, if provided and aborted, MUST interrupt in-progress work (HTTP requests and
   * throttle/backoff waits) and reject with a `DOMException` named `"AbortError"` — used by the
   * presentation layer to cancel a stale fetch (e.g. React `StrictMode`'s double-invoke in dev,
   * or a component unmount) without spending API quota.
   */
  fetchSnapshot(request: SnapshotRequest, signal?: AbortSignal): Promise<Snapshot>
}
