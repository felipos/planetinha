import { Loader2 } from 'lucide-react'
import type { DataFetchStatus } from '../../../domain/data-fetch-status'
import './LoadingOverlay.css'

export interface LoadingOverlayProps {
  readonly status: DataFetchStatus
}

/**
 * Modal bloqueante mostrado só na primeira busca (`status.kind === 'loading'`, US1) — quando
 * ainda não há nenhuma leitura para exibir. Os lotes de requisições ao Open-Meteo são espaçados
 * de propósito para não estourar o limite de rajada da API (ver
 * `OpenMeteoTemperatureDataSource`), então a espera é esperada, não uma falha: este modal deixa
 * isso explícito em vez de deixar o usuário olhando para um globo vazio sem explicação.
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
          As requisições são feitas aos poucos, de propósito, para não estourar o limite da API
          pública de temperatura. Isso pode levar até cerca de um minuto — a espera é esperada.
        </p>
      </div>
    </div>
  )
}
