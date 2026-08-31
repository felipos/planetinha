import 'reflect-metadata'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { container } from 'tsyringe'
import './index.css'
import { DiContainer } from './di-container'
import { FetchTemperatureGridUseCase } from './application/fetch-temperature-grid.use-case'
import { SelectPointUseCase } from './application/select-point.use-case'
import { App } from './presentation/app.component'

// Composition root: the only layer that knows a DI container exists at all. Everything else
// (use cases, presentation) only ever depends on interfaces/classes injected into it.
DiContainer.setup()
const fetchTemperatureGridUseCase = container.resolve(FetchTemperatureGridUseCase)
const selectPointUseCase = container.resolve(SelectPointUseCase)

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Elemento #root não encontrado em index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App fetchTemperatureGridUseCase={fetchTemperatureGridUseCase} selectPointUseCase={selectPointUseCase} />
  </StrictMode>,
)
