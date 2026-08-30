import type { TemperatureGrid } from './temperature-grid'

/**
 * Estado de carregamento/erro da busca de dados (ver data-model.md). Suporta os Edge Cases de
 * API indisponível e conexão lenta do spec: uma falha após sucesso vira `stale-error` mantendo
 * `lastGood` visível, em vez de limpar a visualização.
 */
export type DataFetchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly grid: TemperatureGrid }
  | { readonly kind: 'stale-error'; readonly lastGood: TemperatureGrid; readonly errorMessage: string }
  | { readonly kind: 'hard-error'; readonly errorMessage: string }
