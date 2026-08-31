import { Loader2 } from 'lucide-react'
import type { DataFetchStatus } from '../../../domain/data-fetch-status'
import './loading-overlay.css'

export interface LoadingOverlayProps {
  readonly status: DataFetchStatus
}

/**
 * Blocking modal shown only during the first fetch (`status.kind === 'loading'`) — when there's
 * no Forecast yet to display. Batches of requests to the temperature API are deliberately
 * spaced out to avoid tripping the API's burst limit (see `OpenMeteoTemperatureDataSource`), so
 * the wait is expected, not a failure: this modal makes that explicit instead of leaving the
 * user looking at an empty globe with no explanation.
 */
export function LoadingOverlay({ status }: LoadingOverlayProps) {
  if (status.kind !== 'loading') {
    return null
  }

  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay__card">
        <Loader2 className="loading-overlay__spinner" size={28} aria-hidden="true" />
        <p className="loading-overlay__title">Carregando dados de temperatura globais…</p>
        <p className="loading-overlay__subtitle">
          As requisições são feitas aos poucos, de propósito, para não estourar o limite da API pública de
          temperatura. Isso pode levar até cerca de um minuto — a espera é esperada.
        </p>
      </div>
    </div>
  )
}
