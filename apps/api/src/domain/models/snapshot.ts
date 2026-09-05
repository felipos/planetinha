import type { SweepStatus } from './sweep'

/**
 * One Grid Point's Forecast within a Snapshot, as the wire describes it: a position rather than
 * an id, `null` for No Data, and its own Fetched At.
 */
export interface SnapshotForecast {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  /** `null` exactly when the Grid Point has No Data for this hour — nothing was fetched. */
  readonly fetchedAt: Date | null
}

/** For one hour, how many Grid Points have a temperature out of the total. */
export interface Coverage {
  readonly total: number
  readonly withData: number
}

/**
 * What the collection process is doing, as far as a viewer needs to know. `status` is the most
 * recent Sweep's, `null` when no Sweep has ever started; `completedAt` is when a Sweep last
 * completed, `null` when none ever has — which is what separates "still filling in for the
 * first time" from "this hour genuinely has gaps".
 */
export interface SweepState {
  readonly status: SweepStatus | null
  readonly completedAt: Date | null
}

/**
 * Every Forecast for a single Valid At hour, across the whole Grid, with the context needed to
 * read a sparse one. Assembled per hour from whatever Forecasts exist, so it is not the output
 * of a single Sweep and carries no Snapshot-level Fetched At — that lives on each Forecast.
 */
export interface Snapshot {
  readonly validAt: Date
  readonly resolutionDegrees: number
  readonly coverage: Coverage
  readonly sweep: SweepState
  readonly forecasts: readonly SnapshotForecast[]
}
