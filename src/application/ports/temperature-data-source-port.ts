import type { TemperatureGrid } from '../../domain/temperature-grid'

/**
 * Porta (Princípio III — inversão de dependência) entre a camada de Use Cases e a camada de
 * Data Sources. Ver contracts/temperature-data-source-port.md. Use Cases não sabem nada sobre
 * `fetch`, URLs, formato JSON do Open-Meteo, batching ou CORS — apenas chamam `fetchGrid()`.
 */
export interface TemperatureGridRequest {
  readonly resolutionDegrees: number
}

export interface TemperatureDataSourcePort {
  /**
   * `signal`, se fornecido e abortado, MUST interromper o trabalho em andamento (requisições
   * HTTP e esperas de throttle/backoff) e rejeitar com um `DOMException` de nome `"AbortError"` —
   * usado pela Presentation para cancelar um fetch obsoleto (ex.: efeito duplicado do
   * `StrictMode` em dev, ou desmontagem do componente) sem gastar cota da API à toa.
   */
  fetchGrid(request: TemperatureGridRequest, signal?: AbortSignal): Promise<TemperatureGrid>
}
