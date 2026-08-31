import { TemperatureInterpolator } from './interpolation'

export interface GridPoint {
  readonly latitude: number
  readonly longitude: number
}

/**
 * Generates the regular lat/long grid used by any `TemperatureDataSourcePort` implementation
 * (Open-Meteo, mock, etc.) — centralized here so every implementation produces exactly the
 * same set of points from a given `resolutionDegrees`.
 */
export class GridPointsGenerator {
  static generate(resolutionDegrees: number): readonly GridPoint[] {
    const latSteps = Math.round(180 / resolutionDegrees) + 1
    const lonSteps = Math.round(360 / resolutionDegrees)
    const points: GridPoint[] = []
    for (let i = 0; i < latSteps; i += 1) {
      const latitude = TemperatureInterpolator.roundCoord(-90 + i * resolutionDegrees)
      for (let j = 0; j < lonSteps; j += 1) {
        const longitude = TemperatureInterpolator.roundCoord(-180 + j * resolutionDegrees)
        points.push({ latitude, longitude })
      }
    }
    return points
  }
}
