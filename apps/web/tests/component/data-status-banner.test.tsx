import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { DataStatusBanner } from '../../src/presentation/components/data-status-banner/data-status-banner.component'
import type { DataFetchStatus } from '../../src/domain/data-fetch-status'
import { mockEmptySnapshot } from '../fixtures/snapshot.fixture'

describe('DataStatusBanner', () => {
  it('renders nothing for idle/success (no banner needed)', () => {
    // Arrange & Act
    const { container } = render(<DataStatusBanner status={{ kind: 'idle' }} />)

    // Assert
    expect(container).toBeEmptyDOMElement()
  })

  it('announces partial-success with the Coverage percentage, styled as a warning (not an error)', () => {
    // Arrange
    const status: DataFetchStatus = {
      kind: 'partial-success',
      snapshot: { ...mockEmptySnapshot, expectedPointCount: 100 },
      coveragePercent: 87,
    }

    // Act
    const { getByRole } = render(<DataStatusBanner status={status} />)

    // Assert
    const region = getByRole('status')
    expect(region).toHaveTextContent('87%')
    expect(region.className).toContain('status-banner--warning')
    expect(region.className).not.toContain('status-banner--error')
  })

  it('announces stale-error via an accessible live region, preserving the last-good message', () => {
    // Arrange
    const status: DataFetchStatus = {
      kind: 'stale-error',
      lastGood: mockEmptySnapshot,
      errorMessage: 'falha de rede',
    }

    // Act
    const { getByRole } = render(<DataStatusBanner status={status} />)

    // Assert
    expect(getByRole('status')).toHaveTextContent('falha de rede')
  })

  it('has no automatically detectable accessibility violations', async () => {
    // Arrange
    const { container } = render(<DataStatusBanner status={{ kind: 'hard-error', errorMessage: 'erro' }} />)

    // Act
    const results = await axe(container)

    // Assert
    expect(results.violations).toEqual([])
  })
})
