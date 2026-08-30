import { buildGridLookup, interpolateTemperatureAt } from '../domain/interpolation'
import type { SelectedPoint } from '../domain/selected-point'
import type { TemperatureGrid } from '../domain/temperature-grid'

export interface SelectPointUseCase {
  execute(grid: TemperatureGrid, latitude: number, longitude: number): SelectedPoint
}

/** Deriva um `SelectedPoint` a partir do `TemperatureGrid` atual (US3) — sem estado próprio. */
export function createSelectPointUseCase(): SelectPointUseCase {
  return {
    execute(grid: TemperatureGrid, latitude: number, longitude: number): SelectedPoint {
      const lookup = buildGridLookup(grid)
      const { temperatureCelsius, isInterpolated } = interpolateTemperatureAt(
        lookup,
        latitude,
        longitude,
      )
      return { latitude, longitude, temperatureCelsius, isInterpolated }
    },
  }
}
