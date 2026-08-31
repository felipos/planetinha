import { Clock } from '../../src/infrastructure/clock.service'

/** A `Clock` frozen at one instant, so a test can state which hour "now" falls in. */
export class FixedClock extends Clock {
  constructor(private readonly instant: Date) {
    super()
  }

  override now(): Date {
    return this.instant
  }
}
