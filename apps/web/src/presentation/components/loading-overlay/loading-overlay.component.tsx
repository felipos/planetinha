import { Loader2 } from 'lucide-react'
import type { DataFetchStatus } from '../../../domain/models/data-fetch-status'
import './loading-overlay.css'

export interface LoadingOverlayProps {
  readonly status: DataFetchStatus
}

/**
 * Blocking modal shown only during the first fetch (`status.kind === 'loading'`) — when there's
 * no Forecast yet to display. A single request to Planetinha's own backend answers with the whole
 * Grid, so this is a couple of seconds rather than a wait to be explained away.
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
          Buscando a temperatura de todo o planeta no servidor do Planetinha. Isso costuma levar apenas alguns
          segundos.
        </p>
      </div>
    </div>
  )
}
