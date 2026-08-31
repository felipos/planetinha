import type { Snapshot } from '../../src/domain/snapshot'

/**
 * A fully covered Snapshot with a single Forecast. Spread it and override the fields a test
 * actually cares about instead of rebuilding the whole shape.
 */
export const mockSnapshot: Snapshot = {
  forecasts: [{ latitude: 0, longitude: 0, temperatureCelsius: 21, validAt: '2026-01-01T00:00' }],
  fetchedAt: '2026-01-01T00:00:00Z',
  resolutionDegrees: 10,
  expectedPointCount: 1,
}

/** A Snapshot holding no Forecast at all — the limiting case of partial Coverage. */
export const mockEmptySnapshot: Snapshot = {
  ...mockSnapshot,
  forecasts: [],
  expectedPointCount: 0,
}
