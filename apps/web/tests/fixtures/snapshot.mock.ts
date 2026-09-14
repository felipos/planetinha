import type { Snapshot } from '../../src/domain/models/snapshot'

/**
 * A fully covered Snapshot with a single Forecast. Spread it and override the fields a test
 * actually cares about instead of rebuilding the whole shape.
 */
export const mockSnapshot: Snapshot = {
  forecasts: [{ latitude: 0, longitude: 0, temperatureCelsius: 21, validAt: '2026-01-01T00:00' }],
  resolutionDegrees: 5,
  coverage: { total: 1, withData: 1 },
  sweep: { status: 'completed', completedAt: '2026-01-01T00:26:00Z' },
}

/**
 * A Snapshot with no temperature anywhere, on an instance whose first collection pass has not
 * completed — the limiting case of partial Coverage, and what a freshly deployed instance
 * answers with.
 */
export const mockEmptySnapshot: Snapshot = {
  ...mockSnapshot,
  forecasts: [],
  coverage: { total: 2664, withData: 0 },
  sweep: { status: 'in_progress', completedAt: null },
}
