import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

// jsdom doesn't implement WebGL — three.js's real lifecycle (use-globe-renderer.hook.ts) is
// validated manually by running the app. Here we only validate the wrapper's markup/a11y.
vi.mock('../../src/presentation/components/globe/use-globe-renderer.hook', () => ({
  useGlobeRenderer: () => ({
    containerRef: { current: null },
    viewState: { rotation: { lat: 0, lon: 0 }, zoomDistance: 3 },
    setHeatmapTexture: () => {},
  }),
}))

const { Globe } = await import('../../src/presentation/components/globe/globe.component')

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
