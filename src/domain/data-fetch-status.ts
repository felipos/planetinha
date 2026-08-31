import type { TemperatureGrid } from './temperature-grid'

/**
 * Estado de carregamento/erro da busca de dados (ver data-model.md). Suporta os Edge Cases de
 * API indisponível e conexão lenta do spec: uma falha após sucesso vira `stale-error` mantendo
 * `lastGood` visível, em vez de limpar a visualização.
 *
 * `partial-success` cobre o caso de uma falha (ex.: rate limit persistente) que não impediu
 * TODA a busca — algumas regiões da grade vieram, outras não (ver `TemperatureGrid.expectedPointCount`).
 * Mostra o grid parcial recém-buscado (não o `lastGood` anterior) com um aviso da cobertura,
 * em vez de tratar isso como uma falha total.
 */
export type DataFetchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly grid: TemperatureGrid }
  | {
      readonly kind: 'partial-success'
      readonly grid: TemperatureGrid
      readonly coveragePercent: number
    }
  | { readonly kind: 'stale-error'; readonly lastGood: TemperatureGrid; readonly errorMessage: string }
  | { readonly kind: 'hard-error'; readonly errorMessage: string }
