import type { DataFetchStatus } from '../../../domain/data-fetch-status'
import './DataStatusBanner.css'

export interface DataStatusBannerProps {
  readonly status: DataFetchStatus
}

function messageFor(status: DataFetchStatus): string | null {
  // 'loading' não tem mensagem aqui: o carregamento inicial já é comunicado pelo modal
  // bloqueante `LoadingOverlay`, evitando duas mensagens de "carregando" simultâneas na tela.
  switch (status.kind) {
    case 'idle':
    case 'success':
    case 'loading':
      return null
    case 'stale-error':
      return `Não foi possível atualizar os dados agora (${status.errorMessage}). Mostrando a última leitura disponível.`
    case 'hard-error':
      return `Não foi possível carregar os dados de temperatura (${status.errorMessage}).`
    default:
      return null
  }
}

/** Região acessível (`role="status"`) para os estados de carregamento/erro (Edge Cases do spec). */
export function DataStatusBanner({ status }: DataStatusBannerProps) {
  const message = messageFor(status)
  if (message === null) {
    return null
  }

  const isError = status.kind === 'stale-error' || status.kind === 'hard-error'

  return (
    <div
      className={`status-banner${isError ? ' status-banner--error' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
