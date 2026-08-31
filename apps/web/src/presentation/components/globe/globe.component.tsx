import { useEffect } from 'react'
import type { Snapshot } from '../../../domain/snapshot'
import { HeatmapTexture } from './heatmap-texture'
import { useGlobeRenderer } from './use-globe-renderer.hook'
import './globe.css'

export interface GlobeProps {
  readonly snapshot: Snapshot | null
  readonly onPointSelect?: (latitude: number, longitude: number) => void
}

export function Globe({ snapshot, onPointSelect }: GlobeProps) {
  const { containerRef, setHeatmapTexture } = useGlobeRenderer(onPointSelect)

  useEffect(() => {
    if (snapshot === null) {
      return
    }
    let cancelled = false
    HeatmapTexture.create(snapshot)
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
  }, [snapshot, setHeatmapTexture])

  return (
    <div
      ref={containerRef}
      className="globe"
      role="img"
      aria-label="Globo 3D interativo mostrando o padrão de temperatura global em gradiente de cor"
    />
  )
}
