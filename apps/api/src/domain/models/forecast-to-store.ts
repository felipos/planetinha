/** A Forecast as it is written: keyed by (Grid Point, Valid At), carrying its own Fetched At. */
export interface ForecastToStore {
  readonly gridPointId: number
  readonly validAt: Date
  readonly temperatureCelsius: number | null
  readonly fetchedAt: Date
}
