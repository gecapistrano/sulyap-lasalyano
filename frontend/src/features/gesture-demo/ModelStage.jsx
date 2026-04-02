import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { indexTipMirroredNorm, isIndexPointing } from './handPointing'

const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)
const TWO_PI = Math.PI * 2
const TRANSITION_OFFSCREEN_X = 2.2

export default function ModelStage({
  modelUrl,
  modelScale,
  accentColor,
  dimmed,
  zoomSignal,
  navDirection,
  preloadUrls = [],
  landmarksRef,
  detectorModeRef,
}) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const modelRef = useRef(null)
  const frameRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const pointLightRef = useRef(null)
  const prevZoomSignalRef = useRef(0)
  const zoomTargetDistanceRef = useRef(null)
  const loaderRef = useRef(null)
  const modelCacheRef = useRef(new Map())
  const inFlightRef = useRef(new Map())
  const dimmedRef = useRef(dimmed)
  const pointerOrbitPrevRef = useRef(null)
  const pointerOrbitSmoothRef = useRef({ dx: 0, dy: 0 })

  useEffect(() => {
    dimmedRef.current = dimmed
  }, [dimmed])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 1.2, 3.8)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    rendererRef.current = renderer
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.autoRotate = true
    controls.autoRotateSpeed = 1.2
    // min: closest dolly (model largest). max: farthest dolly (model smallest on screen).
    controls.minDistance = 1
    controls.maxDistance = 14
    controlsRef.current = controls
    zoomTargetDistanceRef.current = camera.position.distanceTo(controls.target)

    scene.add(new THREE.AmbientLight(0xffffff, 1.0))
    const directional = new THREE.DirectionalLight(0xffffff, 1.5)
    directional.position.set(5, 8, 5)
    scene.add(directional)
    const point = new THREE.PointLight(new THREE.Color(accentColor), 0.5)
    point.position.set(-3, 2, -3)
    pointLightRef.current = point
    scene.add(point)

    loaderRef.current = new GLTFLoader()

    const animate = () => {
      if (zoomTargetDistanceRef.current !== null) {
        const offset = new THREE.Vector3().subVectors(camera.position, controls.target)
        const currentDistance = offset.length()
        const targetDistance = zoomTargetDistanceRef.current
        const easedDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, 0.085)
        offset.setLength(easedDistance)
        camera.position.copy(controls.target.clone().add(offset))
      }

      const lr = landmarksRef?.current
      const dim = dimmedRef.current
      const domEl = renderer.domElement
      const mode = detectorModeRef?.current
      const inZoomMode = mode === 'ZOOM'
      // Use instant raw point pose, not only smoothed DRAG — stops orbit as soon as the hand
      // starts closing even if the HUD mode label lags by a few frames.
      const canFingerOrbit = Boolean(
        !dim && lr && lr.length >= 21 && mode === 'DRAG' && isIndexPointing(lr),
      )

      if (canFingerOrbit) {
        controls.autoRotate = false
        const { nx, ny } = indexTipMirroredNorm(lr)
        if (!pointerOrbitPrevRef.current) {
          pointerOrbitPrevRef.current = { nx, ny }
          pointerOrbitSmoothRef.current = { dx: 0, dy: 0 }
        } else {
          const rawDx = nx - pointerOrbitPrevRef.current.nx
          const rawDy = ny - pointerOrbitPrevRef.current.ny
          pointerOrbitPrevRef.current = { nx, ny }
          const sm = pointerOrbitSmoothRef.current
          const alpha = 0.4
          sm.dx = THREE.MathUtils.lerp(sm.dx, rawDx, alpha)
          sm.dy = THREE.MathUtils.lerp(sm.dy, rawDy, alpha)
          const dxPx = sm.dx * domEl.clientWidth
          const dyPx = sm.dy * domEl.clientHeight
          const rs = controls.rotateSpeed
          const h = domEl.clientHeight
          const deadPx = 1.15
          if (Math.abs(dxPx) > deadPx || Math.abs(dyPx) > deadPx) {
            controls._rotateLeft((TWO_PI * rs * dxPx) / h)
            controls._rotateUp((TWO_PI * rs * dyPx) / h)
          }
        }
      } else if (inZoomMode) {
        if (pointerOrbitPrevRef.current) {
          pointerOrbitPrevRef.current = null
          pointerOrbitSmoothRef.current = { dx: 0, dy: 0 }
        }
        controls.autoRotate = false
      } else {
        if (pointerOrbitPrevRef.current) {
          pointerOrbitPrevRef.current = null
          pointerOrbitSmoothRef.current = { dx: 0, dy: 0 }
        }
        controls.autoRotate = true
      }

      controls.update()
      renderer.render(scene, camera)
      frameRef.current = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return
      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      controls.dispose()
      renderer.dispose()
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.()
          if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat.dispose?.())
          else obj.material?.dispose?.()
        }
      })
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const loader = loaderRef.current
    if (!loader || !Array.isArray(preloadUrls) || preloadUrls.length === 0) return

    preloadUrls.forEach((url) => {
      if (!url || modelCacheRef.current.has(url) || inFlightRef.current.has(url)) return
      const task = loader
        .loadAsync(url)
        .then((gltf) => {
          modelCacheRef.current.set(url, gltf.scene)
        })
        .catch(() => {
          // Keep silent; current model remains visible and user can try another item.
        })
        .finally(() => {
          inFlightRef.current.delete(url)
        })
      inFlightRef.current.set(url, task)
    })
  }, [preloadUrls])

  useEffect(() => {
    if (pointLightRef.current) {
      pointLightRef.current.color = new THREE.Color(accentColor)
    }
  }, [accentColor])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    let disposed = false

    const fadeOutCurrent = (current, exitDir) =>
      new Promise((resolve) => {
        if (!current) {
          resolve()
          return
        }
        const startPos = current.position.clone()
        const camera = cameraRef.current
        const right = new THREE.Vector3(1, 0, 0)
        if (camera) right.applyQuaternion(camera.quaternion).normalize()
        const targetPos = startPos.clone().addScaledVector(right, exitDir * TRANSITION_OFFSCREEN_X)
        const start = performance.now()
        current.traverse((child) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((mat) => {
              mat.transparent = true
            })
          }
        })
        const step = (ts) => {
          const t = Math.min((ts - start) / 200, 1)
          const opacity = 1 - t
          current.position.lerpVectors(startPos, targetPos, t)
          current.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material]
              mats.forEach((mat) => {
                mat.opacity = opacity
              })
            }
          })
          if (t < 1) requestAnimationFrame(step)
          else {
            scene.remove(current)
            modelRef.current = null
            resolve()
          }
        }
        requestAnimationFrame(step)
      })

    const loadModel = async () => {
      setIsLoading(true)
      setLoadError('')
      try {
        const loader = loaderRef.current
        if (!loader) return

        const getModelScene = async () => {
          if (modelCacheRef.current.has(modelUrl)) {
            return cloneSkeleton(modelCacheRef.current.get(modelUrl))
          }
          const pending = inFlightRef.current.get(modelUrl)
          if (pending) {
            await pending
            if (modelCacheRef.current.has(modelUrl)) {
              return cloneSkeleton(modelCacheRef.current.get(modelUrl))
            }
          }
          const gltf = await loader.loadAsync(modelUrl)
          modelCacheRef.current.set(modelUrl, gltf.scene)
          return cloneSkeleton(gltf.scene)
        }

        const incoming = await getModelScene()
        if (disposed) return

        const box = new THREE.Box3().setFromObject(incoming)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxAxis = Math.max(size.x, size.y, size.z) || 1
        const normalize = 1 / maxAxis
        incoming.position.sub(center.multiplyScalar(normalize * modelScale))
        incoming.scale.setScalar(normalize * modelScale)

        incoming.traverse((child) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((mat) => {
              mat.transparent = true
              mat.opacity = 1
            })
          }
        })

        const incomingContainer = new THREE.Group()
        incomingContainer.add(incoming)

        const previous = modelRef.current
        const isSwitchingItems = Boolean(previous)
        const camera = cameraRef.current
        const right = new THREE.Vector3(1, 0, 0)
        if (camera) right.applyQuaternion(camera.quaternion).normalize()
        const centerPos = new THREE.Vector3(0, 0, 0)
        const entryPos = centerPos
          .clone()
          .addScaledVector(right, navDirection > 0 ? TRANSITION_OFFSCREEN_X : -TRANSITION_OFFSCREEN_X)
        const exitDir = navDirection > 0 ? -1 : 1
        await fadeOutCurrent(previous, exitDir)

        const finalScale = incomingContainer.scale.clone()
        incomingContainer.position.copy(entryPos)
        if (isSwitchingItems) {
          incomingContainer.scale.copy(finalScale)
          incomingContainer.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material]
              mats.forEach((mat) => {
                mat.opacity = 0
              })
            }
          })
        } else {
          incomingContainer.scale.setScalar(0.001)
        }
        scene.add(incomingContainer)
        modelRef.current = incomingContainer

        const start = performance.now()
        const pop = (ts) => {
          const t = Math.min((ts - start) / 500, 1)
          const slide = 1 - Math.pow(1 - t, 3)
          incomingContainer.position.lerpVectors(entryPos, centerPos, slide)
          if (!isSwitchingItems) {
            const s = easeOutBack(t)
            incomingContainer.scale.set(finalScale.x * s, finalScale.y * s, finalScale.z * s)
          } else {
            incomingContainer.traverse((child) => {
              if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material]
                mats.forEach((mat) => {
                  mat.opacity = t
                })
              }
            })
          }
          if (t < 1) requestAnimationFrame(pop)
          else setIsLoading(false)
        }
        requestAnimationFrame(pop)
      } catch {
        if (!disposed) {
          setLoadError('Model failed to load. Try next item.')
          setIsLoading(false)
        }
      }
    }

    loadModel()
    return () => {
      disposed = true
    }
  }, [modelUrl, modelScale, navDirection])

  useEffect(() => {
    if (!controlsRef.current) return
    const deltaSignal = zoomSignal - prevZoomSignalRef.current
    prevZoomSignalRef.current = zoomSignal
    if (!deltaSignal) return
    const controls = controlsRef.current
    const direction = deltaSignal > 0 ? 1 : -1
    const magnitude = Math.max(0.35, Math.min(1.15, Math.abs(deltaSignal)))
    const camera = cameraRef.current
    if (!camera) return
    const currentTarget = zoomTargetDistanceRef.current ?? camera.position.distanceTo(controls.target)
    const nextTarget = THREE.MathUtils.clamp(
      currentTarget - direction * (0.52 + 0.58 * magnitude),
      controls.minDistance,
      controls.maxDistance,
    )
    zoomTargetDistanceRef.current = nextTarget
  }, [zoomSignal])

  return (
    <div className="absolute inset-0 z-20">
      <div
        ref={mountRef}
        className="h-full w-full transition-[filter] duration-300"
        style={{ filter: dimmed ? 'brightness(0.35)' : 'brightness(1)' }}
      />
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-white/20"
            style={{ borderTopColor: accentColor }}
          />
        </div>
      ) : null}
      {loadError ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-red-400/35 bg-black/60 px-3 py-1 text-xs text-red-200">
          {loadError}
        </div>
      ) : null}
    </div>
  )
}
