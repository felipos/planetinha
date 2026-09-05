import 'reflect-metadata'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { container } from 'tsyringe'
import './index.css'
import { FetchSnapshotUseCase } from './domain/usecases/fetch-snapshot.usecase'
import { SelectPointUseCase } from './domain/usecases/select-point.usecase'
import { App } from './presentation/app.component'

// Composition root: the only layer that knows a DI container exists at all. Every dependency
// here is a concrete class, so tsyringe resolves the whole graph with no registration needed.
const fetchSnapshotUseCase = container.resolve(FetchSnapshotUseCase)
const selectPointUseCase = container.resolve(SelectPointUseCase)

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Elemento #root não encontrado em index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App fetchSnapshotUseCase={fetchSnapshotUseCase} selectPointUseCase={selectPointUseCase} />
  </StrictMode>,
)
