/**
 * The pacing knobs, injected rather than hardcoded so they can be tuned against measured Rate
 * Limit responses without a code change — and so a test can drive a Sweep with a Slice of two.
 */
export interface SweepConfig {
  /** How many Grid Points one Slice advances through on a single Tick. */
  readonly sliceSize: number
  /** How long after a Sweep starts the next one becomes due. Twice a day is 12 hours. */
  readonly sweepIntervalMs: number
}
