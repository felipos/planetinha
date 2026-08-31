/**
 * Ephemeral camera state of the globe — lives in the presentation layer, not persisted
 * between sessions.
 */
export interface GlobeViewState {
  readonly rotation: { readonly lat: number; readonly lon: number }
  readonly zoomDistance: number
}
