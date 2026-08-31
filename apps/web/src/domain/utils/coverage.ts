import type { Coverage, Snapshot } from '../snapshot'

/** Reads a Snapshot's reported Coverage — never counts values to guess at it. */
export class CoverageCalculator {
  /**
   * Whole percent of the Grid that has a temperature for the hour being shown. Rounded down,
   * never up: a Grid missing a handful of Cells out of thousands would otherwise be announced
   * as 100% covered in the same breath as a warning that regions are missing.
   */
  static percent(coverage: Coverage): number {
    if (coverage.total <= 0) {
      return 100
    }
    return Math.floor((coverage.withData / coverage.total) * 100)
  }

  static isComplete(coverage: Coverage): boolean {
    return coverage.withData >= coverage.total
  }

  /**
   * Whether the backend is still filling the Grid in for the very first time. An instance whose
   * first Sweep has not completed is not failing and is not partially covered — it is loading,
   * and should read that way.
   */
  static isInitialLoad(snapshot: Snapshot): boolean {
    return snapshot.sweep.completedAt === null
  }
}
