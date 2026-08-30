import { useMemo } from 'react'
import type { FetchTemperatureGridUseCase } from '../application/fetch-temperature-grid.usecase'
import type { TemperatureGrid } from '../domain/temperature-grid'
import { DataStatusBanner } from './components/DataStatusBanner/DataStatusBanner'
import { Globe } from './components/Globe/Globe'
import { LoadingOverlay } from './components/LoadingOverlay/LoadingOverlay'
import { PointInspector } from './components/PointInspector/PointInspector'
import { TemperatureLegend } from './components/TemperatureLegend/TemperatureLegend'
import { useSelectedPoint } from './hooks/useSelectedPoint'
import { useTemperatureGrid } from './hooks/useTemperatureGrid'
import './App.css'

export interface AppProps {
  readonly fetchTemperatureGridUseCase: FetchTemperatureGridUseCase
}

export function App({ fetchTemperatureGridUseCase }: AppProps) {
  const status = useTemperatureGrid(fetchTemperatureGridUseCase)

  const grid: TemperatureGrid | null = useMemo(() => {
    if (status.kind === 'success') {
      return status.grid
    }
    if (status.kind === 'stale-error') {
      return status.lastGood
    }
    return null
  }, [status])

  const { selectedPoint, selectPoint, clearSelection } = useSelectedPoint(grid)

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
