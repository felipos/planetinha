import * as THREE from 'three'
import { NO_DATA_RGB, temperatureToRgb } from '../../../domain/color-scale'
import { buildGridLookup, interpolateTemperatureAt } from '../../../domain/interpolation'
import type { TemperatureGrid } from '../../../domain/temperature-grid'
import { pixelToLatLon } from './sphere-projection'

/**
 * Gera uma textura raster equiretangular a partir da grade de temperatura (ver research.md
 * §4). Pontos sem dado disponível (`temperatureCelsius: null`, incluindo os que permanecem
 * `null` após a interpolação por falta de vizinhos com dado) recebem a cor neutra de
 * "sem dado" — nunca uma cor da escala, para nunca sugerir um valor enganoso.
 */

const TEXTURE_WIDTH = 360
const TEXTURE_HEIGHT = 180

export function createHeatmapTexture(grid: TemperatureGrid): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const context = canvas.getContext('2d')
  if (context === null) {
    throw new Error('Não foi possível criar o contexto 2D para a textura do heatmap.')
  }

  const lookup = buildGridLookup(grid)
  const imageData = context.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT)

  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const { latitude, longitude } = pixelToLatLon(y, x, TEXTURE_WIDTH, TEXTURE_HEIGHT)
      const { temperatureCelsius } = interpolateTemperatureAt(lookup, latitude, longitude)
      const rgb = temperatureCelsius === null ? NO_DATA_RGB : temperatureToRgb(temperatureCelsius)
      const index = (y * TEXTURE_WIDTH + x) * 4
      imageData.data[index] = rgb[0]
      imageData.data[index + 1] = rgb[1]
      imageData.data[index + 2] = rgb[2]
      imageData.data[index + 3] = 255
    }
  }

  context.putImageData(imageData, 0, 0)

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
