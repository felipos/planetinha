import type { Forecast } from './forecast'

/**
 * Every Forecast for a single Valid At hour, across the whole Grid. A Snapshot is assembled per
 * hour from whatever Forecasts exist — it is not the output of a single collection pass, so
 * several different passes may have written the values it holds. That is also why there is no
 * Snapshot-level Fetched At: it would be a lie. Fetched At belongs to each Forecast.
 */
export interface Snapshot {
  readonly forecasts: readonly Forecast[]
  readonly resolutionDegrees: number
  /**
   * How many Grid Points the Grid holds. The backend always answers with every one of them,
   * using No Data where it has no temperature, so this is the denominator for Coverage rather
   * than a count of what arrived.
   */
  readonly expectedPointCount: number
}
