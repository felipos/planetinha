import { useMemo } from 'react'
import type { FetchTemperatureGridUseCase } from '../application/fetch-temperature-grid.use-case'
import type { SelectPointUseCase } from '../application/select-point.use-case'
import type { TemperatureGrid } from '../domain/temperature-grid'
import { DataStatusBanner } from './components/data-status-banner/data-status-banner.component'
import { Globe } from './components/globe/globe.component'
import { LoadingOverlay } from './components/loading-overlay/loading-overlay.component'
import { PointInspector } from './components/point-inspector/point-inspector.component'
import { TemperatureLegend } from './components/temperature-legend/temperature-legend.component'
import { useSelectedPoint } from './hooks/use-selected-point.hook'
import { useTemperatureGrid } from './hooks/use-temperature-grid.hook'
import './app.css'

export interface AppProps {
  readonly fetchTemperatureGridUseCase: FetchTemperatureGridUseCase
  readonly selectPointUseCase: SelectPointUseCase
}

export function App({ fetchTemperatureGridUseCase, selectPointUseCase }: AppProps) {
  const status = useTemperatureGrid(fetchTemperatureGridUseCase)

  const grid: TemperatureGrid | null = useMemo(() => {
    if (status.kind === 'success' || status.kind === 'partial-success') {
      return status.grid
    }
    if (status.kind === 'stale-error') {
      return status.lastGood
    }
    return null
  }, [status])

  const { selectedPoint, selectPoint, clearSelection } = useSelectedPoint(grid, selectPointUseCase)

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Vento — Temperatura Global em Tempo Real</h1>
      </header>
      <main className="app__globe-area" aria-label="Globo de temperatura global">
        <Globe grid={grid} onPointSelect={selectPoint} />
        <TemperatureLegend />
        <div className="app__top-overlay">
          <DataStatusBanner status={status} />
          <PointInspector point={selectedPoint} onClose={clearSelection} />
        </div>
        <LoadingOverlay status={status} />
      </main>
    </div>
  )
}
