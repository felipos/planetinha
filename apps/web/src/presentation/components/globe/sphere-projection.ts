export interface LatLon {
  readonly latitude: number
  readonly longitude: number
}

const TWO_PI = Math.PI * 2

/**
 * Conversions between a 3D position on the globe sphere (following the same UV convention
 * `THREE.SphereGeometry` uses internally) and lat/long coordinates. Used both to generate the
 * heatmap texture (per pixel) and for click/tap raycasting — keeps both in agreement on which
 * lat/long corresponds to which point on the sphere, instead of relying on two independent
 * formulas.
 */
export class SphereProjection {
  /** Lat/long for the pixel (row, col) of a width×height equirectangular texture. */
  static pixelToLatLon(row: number, col: number, width: number, height: number): LatLon {
    const v = height <= 1 ? 0 : row / (height - 1)
    const u = width <= 1 ? 0 : col / (width - 1)
    return {
      latitude: 90 - v * 180,
      longitude: SphereProjection.wrapDegrees180(u * 360),
    }
  }

  /** Lat/long for a 3D point (x, y, z) on the sphere of radius `radius`. */
  static positionToLatLon(x: number, y: number, z: number, radius: number): LatLon {
    const clampedY = Math.min(Math.max(y / radius, -1), 1)
    const theta = Math.acos(clampedY)
    let phi = Math.atan2(z, -x)
    if (phi < 0) {
      phi += TWO_PI
    }
    return {
      latitude: 90 - (theta * 180) / Math.PI,
      longitude: SphereProjection.wrapDegrees180((phi * 180) / Math.PI),
    }
  }

  private static wrapDegrees180(deg: number): number {
    let wrapped = deg % 360
    if (wrapped > 180) {
      wrapped -= 360
    }
    if (wrapped < -180) {
      wrapped += 360
    }
    return wrapped
  }
}
