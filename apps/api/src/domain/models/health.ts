/**
 * The answer a container health check gets. Deliberately holds nothing derived from a Snapshot,
 * a Forecast, or a Grid Point: a health check runs every few seconds and must stay cheap.
 */
export interface Health {
  readonly status: 'ok'
  readonly checkedAt: string
}
