/**
 * The spacing in degrees between adjacent Grid Points. Bounded by the upstream Budget, not by
 * rendering concerns: at 5° the Grid holds 2,522 Grid Points and two Sweeps a day cost about
 * half the daily allowance, while 2.5° would need more Grid Points than a single day's entire
 * allowance. This is the Resolution the seed materialises and the api reports on the wire.
 */
export const GRID_RESOLUTION_DEGREES = 5
