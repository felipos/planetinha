import type { Snapshot } from '../../domain/snapshot'

/**
 * Port (dependency-inversion seam) between the use-case layer and the data-source layer. Use
 * cases know nothing about `fetch`, URLs, or the JSON shape behind it — they only call
 * `fetchSnapshot()`.
 *
 * There are no request parameters: the backend owns the Grid and its Resolution, and reports
 * both in the Snapshot it answers with.
 */
export interface SnapshotDataSourcePort {
  /**
   * `signal`, if provided and aborted, MUST interrupt in-progress work (the HTTP request and
   * any backoff wait) and reject with a `DOMException` named `"AbortError"` — used by the
   * presentation layer to cancel a stale fetch (e.g. React `StrictMode`'s double-invoke in dev,
   * or a component unmount).
   */
  fetchSnapshot(signal?: AbortSignal): Promise<Snapshot>
}
