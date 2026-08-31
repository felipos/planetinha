import * as THREE from 'three'
import { ColorScale } from '../../../domain/utils/color-scale'
import { TemperatureInterpolator } from '../../../domain/utils/interpolation'
import type { Snapshot } from '../../../domain/snapshot'
import earthBasemapUrl from './earth-basemap.png'
import { SphereProjection } from './sphere-projection'

const TEXTURE_WIDTH = 720
const TEXTURE_HEIGHT = 360
const HEATMAP_OPACITY = 0.72

let basemapImagePromise: Promise<HTMLImageElement> | null = null

/**
 * Generates a raster equirectangular texture from a Snapshot, drawn over a static
 * base map of continents/oceans (`earth-basemap.png`, see
 * `scripts/generate-earth-basemap.mjs`) — the heatmap is layered on top with partial
 * transparency (`HEATMAP_OPACITY`), keeping the continents visible underneath and making it
 * clear this is planet Earth, not an abstract sphere. Grid Points with No Data (including ones
 * that remain `null` after interpolation for lack of neighbours with a temperature) are fully
 * transparent in the heatmap layer — never a scale color, so as to never suggest a misleading
 * value — showing the plain base map there.
 */
export class HeatmapTexture {
  static async create(snapshot: Snapshot): Promise<THREE.CanvasTexture> {
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_WIDTH
    canvas.height = TEXTURE_HEIGHT
    const context = canvas.getContext('2d')
    if (context === null) {
      throw new Error('Não foi possível criar o contexto 2D para a textura do heatmap.')
    }

    const basemap = await HeatmapTexture.loadBasemapImage()
    context.drawImage(basemap, 0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)

    // Separate layer for the heatmap: `putImageData` overwrites pixels without respecting
    // alpha, so it's composited on its own canvas and then drawn onto the base map via
    // `drawImage` (which does "source-over" blending that respects per-pixel alpha).
    const heatmapCanvas = document.createElement('canvas')
    heatmapCanvas.width = TEXTURE_WIDTH
    heatmapCanvas.height = TEXTURE_HEIGHT
    const heatmapContext = heatmapCanvas.getContext('2d')
    if (heatmapContext === null) {
      throw new Error('Não foi possível criar o contexto 2D para a camada de heatmap.')
    }

    const lookup = TemperatureInterpolator.buildCellLookup(snapshot)
    const imageData = heatmapContext.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT)

    for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
      for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
        const { latitude, longitude } = SphereProjection.pixelToLatLon(y, x, TEXTURE_WIDTH, TEXTURE_HEIGHT)
        const { temperatureCelsius } = TemperatureInterpolator.interpolateTemperatureAt(
          lookup,
          latitude,
          longitude,
        )
        const index = (y * TEXTURE_WIDTH + x) * 4
        if (temperatureCelsius === null) {
          imageData.data[index + 3] = 0
          continue
        }
        const rgb = ColorScale.temperatureToRgb(temperatureCelsius)
        imageData.data[index] = rgb[0]
        imageData.data[index + 1] = rgb[1]
        imageData.data[index + 2] = rgb[2]
        imageData.data[index + 3] = Math.round(HEATMAP_OPACITY * 255)
      }
    }

    heatmapContext.putImageData(imageData, 0, 0)
    context.drawImage(heatmapCanvas, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    // Mipmaps + trilinear filtering keep the gradient readable (no aliasing/moiré) at any zoom
    // level — the texture itself only changes when data refreshes, so the mipmap generation
    // cost doesn't affect interaction frame rate.
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    texture.needsUpdate = true
    return texture
  }

  /** Loaded once (a static asset that never changes) and reused on every refresh. */
  private static loadBasemapImage(): Promise<HTMLImageElement> {
    if (basemapImagePromise === null) {
      basemapImagePromise = new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () =>
          reject(new Error('Não foi possível carregar o mapa-base de continentes/oceanos.'))
        image.src = earthBasemapUrl
      })
    }
    return basemapImagePromise
  }
}
