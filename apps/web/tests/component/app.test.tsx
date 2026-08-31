import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FetchSnapshotUseCase } from '../../src/application/fetch-snapshot.use-case'
import { SelectPointUseCase } from '../../src/application/select-point.use-case'
import type { Snapshot } from '../../src/domain/snapshot'
import { mockEmptySnapshot, mockSnapshot } from '../fixtures/snapshot.fixture'

// jsdom implements neither WebGL nor canvas, and the globe's rendering is validated by running
// the app. Here the globe is a placeholder so the surrounding states can be asserted.
vi.mock('../../src/presentation/components/globe/globe.component', () => ({
  Globe: () => <div data-testid="globe" />,
}))

const { App } = await import('../../src/presentation/app.component')

/** A Snapshot of an instance still filling in: no pass has completed, Coverage is partial. */
function fillingIn(withData: number): Snapshot {
  return { ...mockEmptySnapshot, coverage: { total: 100, withData } }
}

/** A Snapshot of an hour that genuinely has gaps: a pass completed, and Coverage is still partial. */
function gappyHour(withData: number): Snapshot {
  return {
    ...mockSnapshot,
    coverage: { total: 100, withData },
    sweep: { status: 'completed', completedAt: '2026-08-31T09:26:00Z' },
  }
}

function fakeUseCase(behaviors: readonly (() => Promise<Snapshot>)[]): FetchSnapshotUseCase {
  let call = 0
  return {
    execute: async () => {
      const behavior = behaviors[Math.min(call, behaviors.length - 1)]
      call += 1
      if (behavior === undefined) {
        throw new Error('no behavior configured')
      }
      return await behavior()
    },
  } as unknown as FetchSnapshotUseCase
}

function renderApp(useCase: FetchSnapshotUseCase): void {
  render(<App fetchSnapshotUseCase={useCase} selectPointUseCase={new SelectPointUseCase()} />)
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

/**
 * Lets the in-flight fetch resolve and React re-render. Until it does, the blocking loading
 * modal is on screen — and it is a `role="status"` region too, so asserting before this would
 * read the wrong element.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('App — what a viewer is told about Coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tells the viewer what percentage of the Grid has data for the hour being shown', async () => {
    // Arrange
    const useCase = fakeUseCase([async () => gappyHour(64)])

    // Act
    renderApp(useCase)
    await settle()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('64%')
  })

  it('reads a first-time fill as an initial load rather than a failure or a gap warning', async () => {
    // Arrange
    const useCase = fakeUseCase([async () => fillingIn(8)])

    // Act
    renderApp(useCase)
    await settle()

    // Assert
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Carga inicial')
    expect(banner).toHaveTextContent('8%')
    expect(banner.className).not.toContain('status-banner--error')
  })

  it('climbs the percentage across refreshes while the first pass runs', async () => {
    // Arrange
    const useCase = fakeUseCase([
      async () => fillingIn(8),
      async () => fillingIn(35),
      async () => fillingIn(77),
    ])
    renderApp(useCase)
    await settle()
    expect(screen.getByRole('status')).toHaveTextContent('8%')

    // Act & Assert
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    })
    expect(screen.getByRole('status')).toHaveTextContent('35%')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    })
    expect(screen.getByRole('status')).toHaveTextContent('77%')
  })

  it('shows no Coverage message once a full Snapshot arrives', async () => {
    // Arrange
    const useCase = fakeUseCase([async () => gappyHour(100)])

    // Act
    renderApp(useCase)
    await settle()

    // Assert
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByTestId('globe')).toBeInTheDocument()
  })

  it('keeps the last good Snapshot on screen with a stale notice when the backend goes away', async () => {
    // Arrange
    const useCase = fakeUseCase([
      async () => gappyHour(100),
      async () => {
        throw new Error('backend fora do ar')
      },
    ])
    renderApp(useCase)
    await settle()
    expect(screen.queryByRole('status')).toBeNull()

    // Act
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    })

    // Assert
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('backend fora do ar')
    expect(banner).toHaveTextContent('últimos dados disponíveis')
    // The globe is still there: a transient blip degrades to a notice, never a blank screen.
    expect(screen.getByTestId('globe')).toBeInTheDocument()
  })
})
