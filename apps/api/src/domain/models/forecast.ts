/**
 * A temperature value for one Grid Point at one Valid At hour, produced by the upstream weather
 * model. Never a measurement: no instrument observed it, and that holds for the present hour as
 * much as for future ones.
 *
 * `temperatureCelsius: null` is No Data and must never be conflated with a real zero.
 */
export interface Forecast {
  readonly gridPointId: number
  readonly validAt: Date
  readonly temperatureCelsius: number | null
  /** The moment Planetinha retrieved this value. Independent of `validAt`, and per Forecast: one
   * retrieval yields many Valid At hours, and a Snapshot may hold rows written by different
   * Sweeps. */
  readonly fetchedAt: Date
}
