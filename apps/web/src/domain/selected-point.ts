/**
 * A point the user tapped/clicked to inspect. Derived on demand from a Snapshot's Forecasts —
 * not persisted state.
 */
export interface SelectedPoint {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly isInterpolated: boolean
}
