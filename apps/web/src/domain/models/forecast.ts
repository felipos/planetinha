/**
 * A temperature value for one Grid Point at one Valid At hour, produced by the upstream weather
 * model. Never a measurement: no instrument observed it, and that holds for the present hour as
 * much as for future ones.
 *
 * `temperatureCelsius: null` explicitly means No Data and must be handled distinctly from `0`
 * (zero degrees is a real temperature).
 */
export interface Forecast {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  /** The hour this value describes. */
  readonly validAt: string
}
