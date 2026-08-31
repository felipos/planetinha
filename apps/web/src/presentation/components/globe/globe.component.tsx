import { useEffect } from 'react'
import type { TemperatureGrid } from '../../../domain/temperature-grid'
import { HeatmapTexture } from './heatmap-texture'
import { useGlobeRenderer } from './use-globe-renderer.hook'
import './globe.css'

export interface GlobeProps {
  readonly grid: TemperatureGrid | null
  readonly onPointSelect?: (latitude: number, longitude: number) => void
}

export function Globe({ grid, onPointSelect }: GlobeProps) {
  const { containerRef, setHeatmapTexture } = useGlobeRenderer(onPointSelect)

  useEffect(() => {
    if (grid === null) {
      return
    }
    let cancelled = false
    HeatmapTexture.create(grid)
      .then((texture) => {
        if (!cancelled) {
          setHeatmapTexture(texture)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('Falha ao gerar a textura do globo:', error)
        }
      })
    return () => {
      cancelled = true
    }
  }, [grid, setHeatmapTexture])

  return (
    <div
      ref={containerRef}
      className="globe"
      role="img"
      aria-label="Globo 3D interativo mostrando o padrão de temperatura global em gradiente de cor"
    />
  )
}
