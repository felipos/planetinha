import type { Snapshot } from './snapshot'

/**
 * Loading/error state of the data fetch. A failure after a previous success becomes
 * `stale-error`, keeping `lastGood` visible instead of clearing the visualization — so a
 * transient backend outage or a slow connection doesn't blank out data the user already has.
 *
 * A Snapshot that isn't fully covered is one of two different situations, and they read
 * differently on screen:
 *
 * - `initial-load`: the backend's first collection pass has not completed, so the Grid is still
 *   filling in. Nothing is wrong; the percentage climbs on each refresh.
 * - `partial-success`: a pass has completed before, so this hour genuinely has gaps.
 */
export type DataFetchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly snapshot: Snapshot }
  | {
      readonly kind: 'initial-load'
      readonly snapshot: Snapshot
      readonly coveragePercent: number
    }
  | {
      readonly kind: 'partial-success'
      readonly snapshot: Snapshot
      readonly coveragePercent: number
    }
  | { readonly kind: 'stale-error'; readonly lastGood: Snapshot; readonly errorMessage: string }
  | { readonly kind: 'hard-error'; readonly errorMessage: string }
