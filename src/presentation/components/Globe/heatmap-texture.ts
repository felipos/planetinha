import * as THREE from 'three'
import { temperatureToRgb } from '../../../domain/color-scale'
import { buildGridLookup, interpolateTemperatureAt } from '../../../domain/interpolation'
import type { TemperatureGrid } from '../../../domain/temperature-grid'
import earthBasemapUrl from './earth-basemap.png'
import { pixelToLatLon } from './sphere-projection'

/**
 * Gera uma textura raster equiretangular a partir da grade de temperatura (ver research.md
 * §4), desenhada sobre um mapa-base estático de continentes/oceanos (`earth-basemap.png`, ver
 * `scripts/generate-earth-basemap.mjs`) — o heatmap entra por cima com transparência parcial
 * (`HEATMAP_OPACITY`), deixando os continentes visíveis por baixo e deixando claro que é o
 * planeta Terra, não uma esfera abstrata. Pontos sem dado disponível
 * (`temperatureCelsius: null`, incluindo os que permanecem `null` após a interpolação por falta
 * de vizinhos com dado) ficam totalmente transparentes na camada de heatmap — nunca uma cor da
 * escala, para nunca sugerir um valor enganoso — mostrando o mapa-base puro nesses pontos.
 */

const TEXTURE_WIDTH = 720
const TEXTURE_HEIGHT = 360
const HEATMAP_OPACITY = 0.72

let basemapImagePromise: Promise<HTMLImageElement> | null = null

/** Carregada uma única vez (é um asset estático que nunca muda) e reaproveitada em todo refresh. */
function loadBasemapImage(): Promise<HTMLImageElement> {
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

export async function createHeatmapTexture(grid: TemperatureGrid): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const context = canvas.getContext('2d')
  if (context === null) {
    throw new Error('Não foi possível criar o contexto 2D para a textura do heatmap.')
  }

  const basemap = await loadBasemapImage()
  context.drawImage(basemap, 0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)

  // Camada separada para o heatmap: `putImageData` sobrescreve pixels sem respeitar alpha, então
  // ele é montado numa canvas própria e depois composto sobre o mapa-base via `drawImage` (que
  // sim faz blending "source-over" respeitando o canal alpha por pixel).
  const heatmapCanvas = document.createElement('canvas')
  heatmapCanvas.width = TEXTURE_WIDTH
  heatmapCanvas.height = TEXTURE_HEIGHT
  const heatmapContext = heatmapCanvas.getContext('2d')
  if (heatmapContext === null) {
    throw new Error('Não foi possível criar o contexto 2D para a camada de heatmap.')
  }

  const lookup = buildGridLookup(grid)
  const imageData = heatmapContext.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT)

  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const { latitude, longitude } = pixelToLatLon(y, x, TEXTURE_WIDTH, TEXTURE_HEIGHT)
      const { temperatureCelsius } = interpolateTemperatureAt(lookup, latitude, longitude)
      const index = (y * TEXTURE_WIDTH + x) * 4
      if (temperatureCelsius === null) {
        imageData.data[index + 3] = 0
        continue
      }
      const rgb = temperatureToRgb(temperatureCelsius)
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
  // Mipmaps + filtro trilinear mantêm o gradiente legível (sem serrilhado/moiré) em qualquer
  // nível de zoom do globo (US2, SC-002) — a textura em si só muda quando os dados são
  // atualizados, então o custo de gerar mipmaps não afeta a taxa de quadros da interação.
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}
