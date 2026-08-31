#!/usr/bin/env node
/**
 * Gera `src/presentation/components/Globe/earth-basemap.png`: um mapa raster equiretangular
 * (continentes vs. oceanos) usado como camada de base do globo, por baixo do heatmap de
 * temperatura semi-transparente (ver `heatmap-texture.ts`).
 *
 * Fonte dos dados geográficos: `world-atlas` (land-110m, domínio público via Natural Earth),
 * convertido de TopoJSON para GeoJSON via `topojson-client`. Roda só em dev/build-time — o
 * resultado é um PNG estático commitado no repo; nada disso entra no bundle de produção
 * (`world-atlas`/`topojson-client`/`pngjs` são devDependencies usadas só por este script).
 *
 * Uso: node scripts/generate-earth-basemap.mjs
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PNG } from 'pngjs'
import { feature } from 'topojson-client'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const OUTPUT_WIDTH = 1024
const OUTPUT_HEIGHT = 512
const SUPERSAMPLE = 2 // 2x2 subamostras por pixel, para bordas de costa suavizadas.
const OUTPUT_PATH = path.join(
  __dirname,
  '../src/presentation/components/Globe/earth-basemap.png',
)

const OCEAN_RGB = [9, 20, 40]
const LAND_RGB = [70, 74, 62]

/** Reproduz exatamente `pixelToLatLon` de `sphere-projection.ts`, para alinhar com a textura do heatmap. */
function pixelToLatLon(row, col, width, height) {
  const v = height <= 1 ? 0 : row / (height - 1)
  const u = width <= 1 ? 0 : col / (width - 1)
  let longitude = (u * 360) % 360
  if (longitude > 180) {
    longitude -= 360
  }
  if (longitude < -180) {
    longitude += 360
  }
  return { latitude: 90 - v * 180, longitude }
}

/** "Desembrulha" uma sequência de longitudes para que não pule >180° entre vértices consecutivos
 * (7 polígonos do dataset cruzam o antimeridiano, ex.: leste da Rússia) — sem isso, o teste
 * ponto-em-polígono planar produziria uma aresta espúria cruzando o mapa inteiro. */
function unwrapRing(ring) {
  const unwrapped = [ring[0]]
  for (let i = 1; i < ring.length; i += 1) {
    let [lon, lat] = ring[i]
    const previousLon = unwrapped[i - 1][0]
    while (lon - previousLon > 180) {
      lon -= 360
    }
    while (lon - previousLon < -180) {
      lon += 360
    }
    unwrapped.push([lon, lat])
  }
  return unwrapped
}

function ringBounds(ring) {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLon, minLat, maxLon, maxLat }
}

function inBounds(lon, lat, bounds) {
  return lon >= bounds.minLon && lon <= bounds.maxLon && lat >= bounds.minLat && lat <= bounds.maxLat
}

/** Ray casting padrão (par/ímpar), em coordenadas planares lon/lat — suficiente para um mapa de fundo decorativo. */
function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

function loadLandPolygons() {
  const land = require('world-atlas/land-110m.json')
  const result = feature(land, land.objects.land)
  const geometry = result.type === 'FeatureCollection' ? result.features[0].geometry : result.geometry

  return geometry.coordinates.map((polygonRings) => {
    const rings = polygonRings.map(unwrapRing)
    return { outer: rings[0], holes: rings.slice(1), bounds: ringBounds(rings[0]) }
  })
}

/** Testa `lon` e seus deslocamentos ±360° (para polígonos desembrulhados fora de [-180,180]). */
function isLand(lon, lat, polygons) {
  for (const shift of [0, 360, -360]) {
    const shiftedLon = lon + shift
    for (const polygon of polygons) {
      if (!inBounds(shiftedLon, lat, polygon.bounds)) {
        continue
      }
      if (!pointInRing(shiftedLon, lat, polygon.outer)) {
        continue
      }
      if (polygon.holes.some((hole) => pointInRing(shiftedLon, lat, hole))) {
        continue
      }
      return true
    }
  }
  return false
}

function main() {
  console.log('Carregando geometria de continentes (world-atlas land-110m)...')
  const polygons = loadLandPolygons()
  console.log(`${polygons.length} polígonos de terra carregados.`)

  const png = new PNG({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT })

  console.log(`Rasterizando em ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (supersample ${SUPERSAMPLE}x${SUPERSAMPLE})...`)
  for (let row = 0; row < OUTPUT_HEIGHT; row += 1) {
    for (let col = 0; col < OUTPUT_WIDTH; col += 1) {
      let landCoverage = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const subRow = row + (sy + 0.5) / SUPERSAMPLE - 0.5
          const subCol = col + (sx + 0.5) / SUPERSAMPLE - 0.5
          const { latitude, longitude } = pixelToLatLon(subRow, subCol, OUTPUT_WIDTH, OUTPUT_HEIGHT)
          if (isLand(longitude, latitude, polygons)) {
            landCoverage += 1
          }
        }
      }
      const t = landCoverage / (SUPERSAMPLE * SUPERSAMPLE)
      const idx = (row * OUTPUT_WIDTH + col) * 4
      png.data[idx] = Math.round(OCEAN_RGB[0] + (LAND_RGB[0] - OCEAN_RGB[0]) * t)
      png.data[idx + 1] = Math.round(OCEAN_RGB[1] + (LAND_RGB[1] - OCEAN_RGB[1]) * t)
      png.data[idx + 2] = Math.round(OCEAN_RGB[2] + (LAND_RGB[2] - OCEAN_RGB[2]) * t)
      png.data[idx + 3] = 255
    }
    if (row % 64 === 0) {
      console.log(`  linha ${row}/${OUTPUT_HEIGHT}`)
    }
  }

  writeFileSync(OUTPUT_PATH, PNG.sync.write(png))
  console.log(`Salvo em ${OUTPUT_PATH}`)
}

main()
