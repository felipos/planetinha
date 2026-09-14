import type { Sweep } from './sweep'

/**
 * What one Tick did. The worker does exactly one of these things per Tick, which is what
 * converts the Budget into a pace: upstream traffic is limited by construction rather than by
 * whatever speed the network happens to allow.
 */
export type TickOutcome =
  /** No Sweep is open and none is due yet. */
  | { readonly kind: 'idle' }
  | { readonly kind: 'sweep-started'; readonly sweep: Sweep }
  | {
      readonly kind: 'slice-advanced'
      readonly sweepId: number
      readonly gridPointCount: number
      readonly cursorGridPointId: number
      readonly forecastCount: number
    }
  /** The Slice's upstream call failed. It is skipped and the Sweep carries on. */
  | {
      readonly kind: 'slice-failed'
      readonly sweepId: number
      readonly gridPointCount: number
      readonly cursorGridPointId: number
      readonly errorMessage: string
    }
  | { readonly kind: 'sweep-completed'; readonly sweepId: number }
