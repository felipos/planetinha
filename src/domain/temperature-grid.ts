import type { TemperatureReading } from './temperature-reading'

/**
 * Agregado com todas as leituras da atualização mais recente (ver data-model.md).
 */
export interface TemperatureGrid {
  readonly readings: readonly TemperatureReading[]
  readonly fetchedAt: string
  readonly resolutionDegrees: number
  /**
   * Quantos pontos a grade DEVERIA ter, dado `resolutionDegrees` — pode ser maior que
   * `readings.length` quando parte da busca falhou (ex.: rate limit persistente numa API
   * externa) mas outra parte teve sucesso: em vez de descartar tudo, `readings` traz só os
   * pontos que vieram com sucesso, e a diferença para `expectedPointCount` mede a cobertura
   * (ver `DataFetchStatus.partial-success`). Igual a `readings.length` numa busca 100% bem-sucedida.
   */
  readonly expectedPointCount: number
}
