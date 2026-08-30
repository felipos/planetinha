import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createFetchTemperatureGridUseCase } from './application/fetch-temperature-grid.usecase'
import { DEFAULT_GRID_RESOLUTION_DEGREES } from './application/config'
import type { TemperatureDataSourcePort } from './application/ports/temperature-data-source-port'
import { MockTemperatureDataSource } from './infrastructure/mock/mock-temperature-data-source'
import { OpenMeteoTemperatureDataSource } from './infrastructure/open-meteo/open-meteo-temperature-data-source'
import { App } from './presentation/App'

// Composition root (Princípio III): a única camada que sabe qual fonte de dados concreta está em
// uso (Open-Meteo real ou mock local) é este arquivo — Use Cases e Presentation só conhecem a
// porta/o use case. `npm run dev:mock` roda o Vite em `--mode mock`, o que faz
// `import.meta.env.MODE` valer `"mock"` sem precisar de nenhuma variável de ambiente extra.
const temperatureDataSource: TemperatureDataSourcePort =
  import.meta.env.MODE === 'mock' ? new MockTemperatureDataSource() : new OpenMeteoTemperatureDataSource()
const fetchTemperatureGridUseCase = createFetchTemperatureGridUseCase(
  temperatureDataSource,
  DEFAULT_GRID_RESOLUTION_DEGREES,
)

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Elemento #root não encontrado em index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App fetchTemperatureGridUseCase={fetchTemperatureGridUseCase} />
  </StrictMode>,
)
