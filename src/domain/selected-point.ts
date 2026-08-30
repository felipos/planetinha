/**
 * Ponto que o usuário tocou/clicou para inspeção (User Story 3, ver data-model.md).
 * Derivado sob demanda a partir de `TemperatureGrid.readings` — não é estado persistente.
 */
export interface SelectedPoint {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly isInterpolated: boolean
}
