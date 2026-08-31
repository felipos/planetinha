import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { GlobeViewState } from '../../../domain/globe-view-state'
import { SphereProjection } from './sphere-projection'

export interface GlobeRendererHandle {
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly viewState: GlobeViewState
  setHeatmapTexture(texture: THREE.Texture): void
}

const SPHERE_RADIUS = 1
const DEFAULT_SPHERE_COLOR = 0x1a2233
const MIN_ZOOM_DISTANCE = 1.3
const MAX_ZOOM_DISTANCE = 6
const CLICK_MOVEMENT_THRESHOLD_PX = 6

const ATMOSPHERE_RADIUS = SPHERE_RADIUS * 1.08
const ATMOSPHERE_COLOR = new THREE.Color(0x7ec8ff)

/**
 * Translucent shell slightly larger than the globe, with a Fresnel-style glow (stronger at the
 * edge/silhouette, invisible head-on) to give the impression of a planet's atmosphere seen from
 * space. A separate object from the data globe (additive, doesn't write to the depth buffer) —
 * purely cosmetic, never alters the actual color of any heatmap point.
 */
function createAtmosphere(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 64, 64)
  const material = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: ATMOSPHERE_COLOR } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 glowColor;
      void main() {
        float intensity = pow(0.75 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(glowColor * intensity * 1.8, intensity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  })
  return new THREE.Mesh(geometry, material)
}

/**
 * Manages the three.js scene/camera/renderer lifecycle, the globe sphere geometry, the orbit
 * controls (rotate/zoom via drag/scroll/pinch), and the click/tap raycasting used for point
 * selection.
 */
export function useGlobeRenderer(
  onPointSelect?: (latitude: number, longitude: number) => void,
): GlobeRendererHandle {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sphereMeshRef = useRef<THREE.Mesh | null>(null)
  const onPointSelectRef = useRef(onPointSelect)
  useEffect(() => {
    onPointSelectRef.current = onPointSelect
  }, [onPointSelect])

  const [viewState, setViewState] = useState<GlobeViewState>({
    rotation: { lat: 0, lon: 0 },
    zoomDistance: 3,
  })

  useEffect(() => {
    const container = containerRef.current
    if (container === null) {
      return
    }
    const containerElement: HTMLDivElement = container

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      45,
      containerElement.clientWidth / Math.max(containerElement.clientHeight, 1),
      0.1,
      100,
    )
    camera.position.z = 3

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(containerElement.clientWidth, containerElement.clientHeight)
    containerElement.appendChild(renderer.domElement)

    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64)
    const material = new THREE.MeshBasicMaterial({ color: DEFAULT_SPHERE_COLOR })
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)
    sphereMeshRef.current = sphere

    const atmosphere = createAtmosphere()
    scene.add(atmosphere)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.enablePan = false
    controls.minDistance = MIN_ZOOM_DISTANCE
    controls.maxDistance = MAX_ZOOM_DISTANCE
    controls.rotateSpeed = 0.6
    controls.zoomSpeed = 0.8

    function handleControlsChange(): void {
      const polarAngle = controls.getPolarAngle()
      const azimuthalAngle = controls.getAzimuthalAngle()
      setViewState({
        rotation: {
          lat: 90 - THREE.MathUtils.radToDeg(polarAngle),
          lon: THREE.MathUtils.radToDeg(azimuthalAngle),
        },
        zoomDistance: camera.position.length(),
      })
    }
    controls.addEventListener('change', handleControlsChange)

    const raycaster = new THREE.Raycaster()
    let pointerDownPosition: { x: number; y: number } | null = null

    function selectAtClientPoint(clientX: number, clientY: number): void {
      const rect = renderer.domElement.getBoundingClientRect()
      const pointerNdc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointerNdc, camera)
      const intersections = raycaster.intersectObject(sphere)
      const hit = intersections[0]
      if (hit === undefined) {
        return
      }
      const { latitude, longitude } = SphereProjection.positionToLatLon(
        hit.point.x,
        hit.point.y,
        hit.point.z,
        SPHERE_RADIUS,
      )
      onPointSelectRef.current?.(latitude, longitude)
    }

    function handlePointerDown(event: PointerEvent): void {
      pointerDownPosition = { x: event.clientX, y: event.clientY }
    }

    function handlePointerUp(event: PointerEvent): void {
      const downPosition = pointerDownPosition
      pointerDownPosition = null
      if (downPosition === null) {
        return
      }
      const movement = Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y)
      if (movement > CLICK_MOVEMENT_THRESHOLD_PX) {
        return
      }
      selectAtClientPoint(event.clientX, event.clientY)
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    renderer.domElement.addEventListener('pointerup', handlePointerUp)

    let animationFrameId: number
    function renderFrame(): void {
      controls.update()
      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(renderFrame)
    }
    renderFrame()

    function handleResize(): void {
      const width = containerElement.clientWidth
      const height = Math.max(containerElement.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      controls.removeEventListener('change', handleControlsChange)
      controls.dispose()
      geometry.dispose()
      material.dispose()
      atmosphere.geometry.dispose()
      ;(atmosphere.material as THREE.Material).dispose()
      renderer.dispose()
      containerElement.removeChild(renderer.domElement)
      sphereMeshRef.current = null
    }
  }, [])

  const setHeatmapTexture = useCallback((texture: THREE.Texture) => {
    const sphere = sphereMeshRef.current
    if (sphere === null) {
      return
    }
    const material = sphere.material as THREE.MeshBasicMaterial
    if (material.map !== null) {
      material.map.dispose()
    }
    material.map = texture
    // `MeshBasicMaterial.color` MULTIPLIES the texture — without resetting it to white here,
    // the dark placeholder color (`DEFAULT_SPHERE_COLOR`) kept tinting the whole heatmap,
    // darkening warm tones and nearly erasing cold ones against the black background.
    material.color.set(0xffffff)
    material.needsUpdate = true
  }, [])

  return { containerRef, viewState, setHeatmapTexture }
}
