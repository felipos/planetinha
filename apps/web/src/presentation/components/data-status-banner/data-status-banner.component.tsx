import type { DataFetchStatus } from '../../../domain/data-fetch-status'
import './data-status-banner.css'

export interface DataStatusBannerProps {
  readonly status: DataFetchStatus
}

function messageFor(status: DataFetchStatus): string | null {
  // 'loading' has no message here: the initial fetch is already communicated by the blocking
  // `LoadingOverlay` modal, avoiding two simultaneous "loading" messages on screen.
  switch (status.kind) {
    case 'idle':
    case 'success':
    case 'loading':
      return null
    case 'initial-load':
      return `Carga inicial dos dados: ${status.coveragePercent}% do globo preenchido. O restante aparece aos poucos, conforme o servidor coleta as previsões.`
    case 'partial-success':
      return `Nesta hora, ${status.coveragePercent}% do globo tem previsão disponível. As demais regiões ficam sem dado até a próxima coleta.`
    case 'stale-error':
      return `Não foi possível atualizar os dados agora (${status.errorMessage}). Mostrando os últimos dados disponíveis.`
    case 'hard-error':
      return `Não foi possível carregar os dados de temperatura (${status.errorMessage}).`
    default:
      return null
  }
}

/**
 * Accessible region (`role="status"`) for the loading/error/Coverage states.
 *
 * An instance still filling in for the first time is deliberately not styled as a warning: it
 * is normal progress, and reads differently from an hour that genuinely has gaps.
 */
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
