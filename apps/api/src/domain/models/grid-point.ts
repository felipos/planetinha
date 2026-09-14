/**
 * One latitude/longitude pair Planetinha collects temperature for. The set of them is enumerated
 * in the database and never derived at runtime, at the single Resolution `GRID_RESOLUTION_DEGREES`
 * names (see `0006-resolution-is-a-code-constant-not-stored-data.md` for why that is a constant
 * rather than a value carried on each Grid Point).
 */
export interface GridPoint {
  readonly latitude: number
  readonly longitude: number
}

/** A Grid Point as stored, identified by the id a Sweep's cursor refers to. */
export interface StoredGridPoint extends GridPoint {
  readonly id: number
}
