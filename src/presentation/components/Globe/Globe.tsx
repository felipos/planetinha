import { useEffect } from 'react'
import type { TemperatureGrid } from '../../../domain/temperature-grid'
import { createHeatmapTexture } from './heatmap-texture'
import { useGlobeRenderer } from './useGlobeRenderer'
import './Globe.css'

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
    const texture = createHeatmapTexture(grid)
    setHeatmapTexture(texture)
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
