import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

// jsdom não implementa WebGL — o ciclo de vida real do three.js (useGlobeRenderer) é testado
// manualmente via quickstart.md. Aqui validamos apenas a marcação/acessibilidade do wrapper.
vi.mock('../../src/presentation/components/Globe/useGlobeRenderer', () => ({
  useGlobeRenderer: () => ({
    containerRef: { current: null },
    viewState: { rotation: { lat: 0, lon: 0 }, zoomDistance: 3 },
    setHeatmapTexture: () => {},
  }),
}))

const { Globe } = await import('../../src/presentation/components/Globe/Globe')

describe('Globe', () => {
  it('exposes a text alternative for the visualization (a11y)', () => {
    const { getByRole } = render(<Globe grid={null} />)
    expect(
      getByRole('img', { name: /globo 3d interativo mostrando o padrão de temperatura global/i }),
    ).toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<Globe grid={null} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
