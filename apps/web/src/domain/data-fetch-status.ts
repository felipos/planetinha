import type { TemperatureGrid } from './temperature-grid'

/**
 * Loading/error state of the data fetch. A failure after a previous success becomes
 * `stale-error`, keeping `lastGood` visible instead of clearing the visualization — so a
 * transient API outage or a slow connection doesn't blank out data the user already has.
 *
 * `partial-success` covers a failure (e.g. a persistent rate limit) that didn't block the
 * ENTIRE fetch — some regions of the grid came back, others didn't (see
 * `TemperatureGrid.expectedPointCount`). It shows the freshly-fetched partial grid (not the
 * previous `lastGood`) with a coverage warning, instead of treating it as a total failure.
 */
export type DataFetchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly grid: TemperatureGrid }
  | {
      readonly kind: 'partial-success'
      readonly grid: TemperatureGrid
      readonly coveragePercent: number
    }
  | { readonly kind: 'stale-error'; readonly lastGood: TemperatureGrid; readonly errorMessage: string }
  | { readonly kind: 'hard-error'; readonly errorMessage: string }
