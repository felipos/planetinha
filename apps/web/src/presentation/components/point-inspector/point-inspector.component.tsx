import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { SelectedPoint } from '../../../domain/selected-point'
import './point-inspector.css'

export interface PointInspectorProps {
  readonly point: SelectedPoint | null
  readonly onClose: () => void
}

function formatCoordinate(value: number, positiveSuffix: string, negativeSuffix: string): string {
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix
  return `${Math.abs(value).toFixed(2)}° ${suffix}`
}

/**
 * Accessible panel with the numeric temperature value plus the Grid Point it belongs to. The
 * coordinates are the containing Cell's own, not the position clicked, so the number is never
 * attributed to a place Vento did not sample.
 */
export function PointInspector({ point, onClose }: PointInspectorProps) {
  useEffect(() => {
    if (point === null) {
      return
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [point, onClose])

  if (point === null) {
    return null
  }

  const locationLabel = `${formatCoordinate(point.latitude, 'N', 'S')}, ${formatCoordinate(point.longitude, 'L', 'O')}`
  const temperatureLabel =
    point.temperatureCelsius === null
      ? 'Sem dado disponível para este ponto'
      : `${point.temperatureCelsius.toFixed(1)} °C`

  return (
    <div className="point-inspector" role="region" aria-label="Detalhes do ponto selecionado">
      <button
        type="button"
        className="point-inspector__close"
        onClick={onClose}
        aria-label="Fechar detalhes do ponto"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <p className="point-inspector__temperature">{temperatureLabel}</p>
      <p className="point-inspector__location">{locationLabel}</p>
    </div>
  )
}
