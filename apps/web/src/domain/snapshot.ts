import type { Forecast } from './forecast'

/**
 * Every Forecast for a single Valid At hour, across the whole Grid. A Snapshot is assembled per
 * hour from whatever Forecasts exist — it is not the output of a single collection pass, so
 * several different passes may have written the values it holds.
 */
export interface Snapshot {
  readonly forecasts: readonly Forecast[]
  readonly fetchedAt: string
  readonly resolutionDegrees: number
  /**
   * How many Grid Points the Snapshot SHOULD hold, given `resolutionDegrees` — can be larger
   * than `forecasts.length` when part of the fetch failed (e.g. a persistent rate limit on an
   * external API) but another part succeeded: instead of discarding everything, `forecasts`
   * only carries the Grid Points that came back, and the gap to `expectedPointCount` measures
   * the Coverage (see `DataFetchStatus.partial-success`). Equal to `forecasts.length` on a
   * fully covered hour.
   */
  readonly expectedPointCount: number
}
