/**
 * A point the user tapped/clicked to inspect. Derived on demand from
 * `TemperatureGrid.readings` — not persisted state.
 */
export interface SelectedPoint {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly isInterpolated: boolean
}
