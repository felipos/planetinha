/**
 * A temperature reading at a geographic coordinate. `temperatureCelsius: null` explicitly
 * represents "no data available" and must be handled distinctly from `0` (zero degrees is a
 * valid value).
 */
export interface TemperatureReading {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly observedAt: string
}
