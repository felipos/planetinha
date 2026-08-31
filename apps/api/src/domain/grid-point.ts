/**
 * One latitude/longitude pair Vento collects temperature for, together with the Resolution it
 * belongs to. The set of them is enumerated in the database and never derived at runtime; the
 * Resolution travels with each Grid Point so that a reseed at a different Resolution cannot
 * silently produce a Snapshot mixing two lattices.
 */
export interface GridPoint {
  readonly latitude: number
  readonly longitude: number
  readonly resolutionDegrees: number
}

/** A Grid Point as stored, identified by the id a Sweep's cursor refers to. */
export interface StoredGridPoint extends GridPoint {
  readonly id: number
}
