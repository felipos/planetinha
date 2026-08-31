import type { StoredGridPoint } from '../../domain/grid-point'

/** One hourly Forecast fetched for one Grid Point. `null` is No Data, never zero. */
export interface FetchedForecast {
  readonly gridPointId: number
  readonly validAt: Date
  readonly temperatureCelsius: number | null
}

export interface FetchedForecastWindow {
  readonly forecasts: readonly FetchedForecast[]
  /** The moment these values were retrieved, stamped on every Forecast they produce. */
  readonly fetchedAt: Date
}

/**
 * What it cost is reported as it happens rather than in the result, because a call that ends in
 * a failure still spent Budget — and a Sweep has to record what it spent either way.
 */
export interface FetchForecastsOptions {
  readonly signal?: AbortSignal
  /** Called once per HTTP request issued, retries included. */
  onUpstreamCall?(): void
  /** Called once per Rate Limit response, so the caller can log it against its own Slice. */
  onRateLimited?(): void
}

/**
 * Port (dependency-inversion seam) for the api's one and only door to the upstream weather
 * provider. The caller passes the Grid Points it wants and gets Forecasts back; how many go in
 * one call, what the payload looks like, and how it maps to the domain all stay behind here.
 *
 * The provider has no pagination — no cursor, no page, no continuation token — so the only axis
 * for splitting a request is the number of Grid Points in it. Deciding how to split is the
 * caller's job, not this port's.
 */
export interface ForecastSourcePort {
  /**
   * An hourly temperature series covering two forecast days for each Grid Point given, which is
   * what makes freshness stop depending on how often we Sweep. Values are model output: they
   * are Forecasts, never readings, and that holds for the present hour too.
   */
  fetchForecastWindow(
    gridPoints: readonly StoredGridPoint[],
    options?: FetchForecastsOptions,
  ): Promise<FetchedForecastWindow>
}
