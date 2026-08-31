import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { LoadingOverlay } from '../../src/presentation/components/loading-overlay/loading-overlay.component'
import type { DataFetchStatus } from '../../src/domain/data-fetch-status'
import { mockEmptySnapshot } from '../fixtures/snapshot.fixture'

describe('LoadingOverlay', () => {
  it('renders nothing outside the initial loading state', () => {
    // Arrange
    const statuses: DataFetchStatus[] = [
      { kind: 'idle' },
      { kind: 'success', snapshot: mockEmptySnapshot },
      {
        kind: 'partial-success',
        snapshot: { ...mockEmptySnapshot, expectedPointCount: 100 },
        coveragePercent: 50,
      },
      { kind: 'stale-error', lastGood: mockEmptySnapshot, errorMessage: 'falha' },
      { kind: 'hard-error', errorMessage: 'falha' },
    ]

    for (const status of statuses) {
      // Act
      const { container } = render(<LoadingOverlay status={status} />)

      // Assert
      expect(container).toBeEmptyDOMElement()
    }
  })

  it('announces the loading state via an accessible live region', () => {
    // Arrange & Act
    const { getByRole } = render(<LoadingOverlay status={{ kind: 'loading' }} />)

    // Assert
    expect(getByRole('status')).toHaveTextContent('Carregando dados de temperatura globais')
  })

  it('has no automatically detectable accessibility violations', async () => {
    // Arrange
    const { container } = render(<LoadingOverlay status={{ kind: 'loading' }} />)

    // Act
    const results = await axe(container)

    // Assert
    expect(results.violations).toEqual([])
  })
})
