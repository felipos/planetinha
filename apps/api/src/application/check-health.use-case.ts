import { injectable } from 'tsyringe'
import type { Health } from '../domain/health'
import { Clock } from '../infrastructure/clock.service'

/**
 * Answers "is this process up?" and nothing more. It touches no Snapshot, Forecast, or Grid
 * Point, so a container can call it every few seconds without cost.
 */
@injectable()
export class CheckHealthUseCase {
  constructor(private readonly clock: Clock) {}

  execute(): Health {
    return { status: 'ok', checkedAt: this.clock.now().toISOString() }
  }
}
