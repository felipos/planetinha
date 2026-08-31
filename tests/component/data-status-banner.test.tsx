import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { DataStatusBanner } from '../../src/presentation/components/data-status-banner/data-status-banner.component'
import type { DataFetchStatus } from '../../src/domain/data-fetch-status'

describe('DataStatusBanner', () => {
  it('renders nothing for idle/success (no banner needed)', () => {
    const { container } = render(<DataStatusBanner status={{ kind: 'idle' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('announces partial-success with the coverage percentage, styled as a warning (not an error)', () => {
    const status: DataFetchStatus = {
      kind: 'partial-success',
      grid: {
        readings: [],
        fetchedAt: '2026-01-01T00:00:00Z',
        resolutionDegrees: 10,
        expectedPointCount: 100,
      },
      coveragePercent: 87,
    }
    const { getByRole } = render(<DataStatusBanner status={status} />)
    const region = getByRole('status')
    expect(region).toHaveTextContent('87%')
    expect(region.className).toContain('status-banner--warning')
    expect(region.className).not.toContain('status-banner--error')
  })

  it('announces stale-error via an accessible live region, preserving the last-good message', () => {
    const status: DataFetchStatus = {
      kind: 'stale-error',
      lastGood: {
        readings: [],
        fetchedAt: '2026-01-01T00:00:00Z',
        resolutionDegrees: 10,
        expectedPointCount: 0,
      },
      errorMessage: 'falha de rede',
    }
    const { getByRole } = render(<DataStatusBanner status={status} />)
    const region = getByRole('status')
    expect(region).toHaveTextContent('falha de rede')
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<DataStatusBanner status={{ kind: 'hard-error', errorMessage: 'erro' }} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
