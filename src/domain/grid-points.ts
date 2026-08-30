import { roundCoord } from './interpolation'

/**
 * Geração da grade regular lat/long usada por qualquer `TemperatureDataSourcePort` (Open-Meteo,
 * mock, etc.) — extraído para cá para que todas as implementações produzam exatamente a mesma
 * grade de pontos a partir de `resolutionDegrees`.
 */
export interface GridPoint {
  readonly latitude: number
  readonly longitude: number
}

export function generateGridPoints(resolutionDegrees: number): readonly GridPoint[] {
  const latSteps = Math.round(180 / resolutionDegrees) + 1
  const lonSteps = Math.round(360 / resolutionDegrees)
  const points: GridPoint[] = []
  for (let i = 0; i < latSteps; i += 1) {
    const latitude = roundCoord(-90 + i * resolutionDegrees)
    for (let j = 0; j < lonSteps; j += 1) {
      const longitude = roundCoord(-180 + j * resolutionDegrees)
      points.push({ latitude, longitude })
    }
  }
  return points
}
