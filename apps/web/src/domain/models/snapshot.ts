import type { Forecast } from './forecast'

/** For one hour, how many Grid Points have a temperature out of the total. */
export interface Coverage {
  readonly total: number
  readonly withData: number
}

/**
 * What the backend's collection process is doing. `completedAt` is `null` until a Sweep has
 * completed for the first time, which is what separates an instance still filling in for the
 * first time from an hour that genuinely has gaps.
 */
export interface SweepState {
  readonly status: string | null
  readonly completedAt: string | null
}

/**
 * Every Forecast for a single Valid At hour, across the whole Grid. A Snapshot is assembled per
 * hour from whatever Forecasts exist — it is not the output of a single collection pass, so
 * several different passes may have written the values it holds. That is also why there is no
 * Snapshot-level Fetched At: it would be a lie. Fetched At belongs to each Forecast.
 *
 * The backend always answers with every Grid Point, using No Data where it has no temperature,
 * so Coverage is reported rather than inferred from how many values happened to arrive.
 */
export interface Snapshot {
  readonly forecasts: readonly Forecast[]
  readonly resolutionDegrees: number
  readonly coverage: Coverage
  readonly sweep: SweepState
}
