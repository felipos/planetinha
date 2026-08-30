/**
 * Conversões entre a posição 3D na esfera do globo (seguindo a mesma convenção de UV usada
 * internamente por `THREE.SphereGeometry`) e coordenadas geográficas lat/long. Usado tanto
 * para gerar a textura do heatmap (`heatmap-texture.ts`, por pixel) quanto para o raycast de
 * clique/toque (`useGlobeRenderer.ts`, US3) — garante que os dois concordem sobre qual
 * lat/long corresponde a qual ponto da esfera, sem depender de duas fórmulas independentes.
 */

export interface LatLon {
  readonly latitude: number
  readonly longitude: number
}

const TWO_PI = Math.PI * 2

function wrapDegrees180(deg: number): number {
  let wrapped = deg % 360
  if (wrapped > 180) {
    wrapped -= 360
  }
  if (wrapped < -180) {
    wrapped += 360
  }
  return wrapped
}

/** Lat/long correspondente ao pixel (row, col) de uma textura equiretangular width×height. */
export function pixelToLatLon(row: number, col: number, width: number, height: number): LatLon {
  const v = height <= 1 ? 0 : row / (height - 1)
  const u = width <= 1 ? 0 : col / (width - 1)
  return {
    latitude: 90 - v * 180,
    longitude: wrapDegrees180(u * 360),
  }
}

/** Lat/long correspondente a um ponto 3D (x, y, z) sobre a esfera de raio `radius`. */
export function positionToLatLon(x: number, y: number, z: number, radius: number): LatLon {
  const clampedY = Math.min(Math.max(y / radius, -1), 1)
  const theta = Math.acos(clampedY)
  let phi = Math.atan2(z, -x)
  if (phi < 0) {
    phi += TWO_PI
  }
  return {
    latitude: 90 - (theta * 180) / Math.PI,
    longitude: wrapDegrees180((phi * 180) / Math.PI),
  }
}
