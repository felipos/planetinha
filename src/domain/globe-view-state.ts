/**
 * Estado efêmero de câmera do globo (ver data-model.md) — vive na camada de Presentation,
 * não é persistido entre sessões.
 */
export interface GlobeViewState {
  readonly rotation: { readonly lat: number; readonly lon: number }
  readonly zoomDistance: number
}
