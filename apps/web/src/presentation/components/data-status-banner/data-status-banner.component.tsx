import type { DataFetchStatus } from '../../../domain/data-fetch-status'
import './data-status-banner.css'

export interface DataStatusBannerProps {
  readonly status: DataFetchStatus
}

function messageFor(status: DataFetchStatus): string | null {
  // 'loading' has no message here: the initial load is already communicated by the blocking
  // `LoadingOverlay` modal, avoiding two simultaneous "loading" messages on screen.
  switch (status.kind) {
    case 'idle':
    case 'success':
    case 'loading':
      return null
    case 'partial-success':
      return `Só foi possível carregar ${status.coveragePercent}% dos dados de temperatura nesta atualização. As regiões restantes ficam sem dado até a próxima tentativa.`
    case 'stale-error':
      return `Não foi possível atualizar os dados agora (${status.errorMessage}). Mostrando os últimos dados disponíveis.`
    case 'hard-error':
      return `Não foi possível carregar os dados de temperatura (${status.errorMessage}).`
    default:
      return null
  }
}

/** Accessible region (`role="status"`) for the loading/error/partial-coverage states. */
export function DataStatusBanner({ status }: DataStatusBannerProps) {
  const message = messageFor(status)
  if (message === null) {
    return null
  }

  const isError = status.kind === 'stale-error' || status.kind === 'hard-error'
  const isWarning = status.kind === 'partial-success'
  const modifierClass = isError ? ' status-banner--error' : isWarning ? ' status-banner--warning' : ''

  return (
    <div className={`status-banner${modifierClass}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
