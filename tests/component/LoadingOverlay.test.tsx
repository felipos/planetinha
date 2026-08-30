import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { LoadingOverlay } from '../../src/presentation/components/LoadingOverlay/LoadingOverlay'
import type { DataFetchStatus } from '../../src/domain/data-fetch-status'

describe('LoadingOverlay', () => {
  it('renders nothing outside the initial loading state', () => {
    const statuses: DataFetchStatus[] = [
      { kind: 'idle' },
      { kind: 'success', grid: { readings: [], fetchedAt: '2026-01-01T00:00:00Z', resolutionDegrees: 10 } },
      {
        kind: 'stale-error',
        lastGood: { readings: [], fetchedAt: '2026-01-01T00:00:00Z', resolutionDegrees: 10 },
        errorMessage: 'falha',
      },
      { kind: 'hard-error', errorMessage: 'falha' },
    ]

    for (const status of statuses) {
      const { container } = render(<LoadingOverlay status={status} />)
      expect(container).toBeEmptyDOMElement()
    }
  })

  it('announces the loading state via an accessible live region', () => {
    const { getByRole } = render(<LoadingOverlay status={{ kind: 'loading' }} />)
    expect(getByRole('status')).toHaveTextContent('Carregando dados de temperatura globais')
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<LoadingOverlay status={{ kind: 'loading' }} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
