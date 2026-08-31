import type { TemperatureReading } from './temperature-reading'

/**
 * Aggregate holding every reading from the most recent update.
 */
export interface TemperatureGrid {
  readonly readings: readonly TemperatureReading[]
  readonly fetchedAt: string
  readonly resolutionDegrees: number
  /**
   * How many points the grid SHOULD have, given `resolutionDegrees` — can be larger than
   * `readings.length` when part of the fetch failed (e.g. a persistent rate limit on an
   * external API) but another part succeeded: instead of discarding everything, `readings`
   * only carries the points that came back successfully, and the gap to `expectedPointCount`
   * measures the coverage (see `DataFetchStatus.partial-success`). Equal to `readings.length`
   * on a 100%-successful fetch.
   */
  readonly expectedPointCount: number
}
