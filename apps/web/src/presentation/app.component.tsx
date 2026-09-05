import { useMemo } from 'react'
import type { FetchSnapshotUseCase } from '../application/fetch-snapshot.use-case'
import type { SelectPointUseCase } from '../application/select-point.use-case'
import type { Snapshot } from '../domain/snapshot'
import { DataStatusBanner } from './components/data-status-banner/data-status-banner.component'
import { Globe } from './components/globe/globe.component'
import { LoadingOverlay } from './components/loading-overlay/loading-overlay.component'
import { PointInspector } from './components/point-inspector/point-inspector.component'
import { TemperatureLegend } from './components/temperature-legend/temperature-legend.component'
import { useSelectedPoint } from './hooks/use-selected-point.hook'
import { useSnapshot } from './hooks/use-snapshot.hook'
import './app.css'

export interface AppProps {
  readonly fetchSnapshotUseCase: FetchSnapshotUseCase
  readonly selectPointUseCase: SelectPointUseCase
}

export function App({ fetchSnapshotUseCase, selectPointUseCase }: AppProps) {
  const status = useSnapshot(fetchSnapshotUseCase)

  const snapshot: Snapshot | null = useMemo(() => {
    switch (status.kind) {
      case 'success':
      case 'initial-load':
      case 'partial-success':
        return status.snapshot
      case 'stale-error':
        return status.lastGood
      default:
        return null
    }
  }, [status])

  const { selectedPoint, selectPoint, clearSelection } = useSelectedPoint(snapshot, selectPointUseCase)

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Planetinha — Temperatura Global em Tempo Real</h1>
      </header>
      <main className="app__globe-area" aria-label="Globo de temperatura global">
        <Globe snapshot={snapshot} onPointSelect={selectPoint} />
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
