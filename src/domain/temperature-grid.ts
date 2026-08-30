import type { TemperatureReading } from './temperature-reading'

/**
 * Agregado com todas as leituras da atualização mais recente (ver data-model.md).
 */
export interface TemperatureGrid {
  readonly readings: readonly TemperatureReading[]
  readonly fetchedAt: string
  readonly resolutionDegrees: number
}
