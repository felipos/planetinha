import { injectable } from 'tsyringe'

/**
 * The only place the api reads the wall clock. Injected rather than called statically so that a
 * test can drive time (a Sweep being due, the hour a Snapshot describes) without waiting for it.
 */
@injectable()
export class Clock {
  now(): Date {
    return new Date()
  }
}
