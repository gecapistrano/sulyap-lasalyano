import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

/**
 * ModelViewer — interactive placeholder 3D model with OrbitControls.
 *
 * Props:
 * - artifactLabel: string shown at the top
 * - artifact: full detection object (used to show hint/label only for now)
 * - dimmed: boolean; when true we apply brightness-50 filter
 * - onTap: called when the user taps/clicks anywhere in the component
 */
export default function ModelViewer({ artifactLabel, dimmed = false, onTap }) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const canvasRef = useRef(null)
  const lastTapTsRef = useRef(0)

  const [hasPoppedIn, setHasPoppedIn] = useState(false)

  const placeholderMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x1d9e75,
      metalness: 0.4,
      roughness: 0.3,
    })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor('#0a0a0f', 1) // solid dark background

    rendererRef.current = renderer
    container.appendChild(renderer.domElement)
    canvasRef.current = renderer.domElement

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100)
    camera.position.set(0, 0.2, 2.2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minDistance = 1.0
    controls.maxDistance = 4.0
    controls.autoRotate = true
    controls.autoRotateSpeed = 1.5

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 1.2)
    directional.position.set(5, 5, 5)
    scene.add(directional)

    // Placeholder geometry
    const geometry = new THREE.TorusKnotGeometry(0.8, 0.25, 128, 16)
    const mesh = new THREE.Mesh(geometry, placeholderMaterial)
    scene.add(mesh)

    // Start scale at 0 for pop-in animation
    mesh.scale.set(0, 0, 0)

    let rafId = 0
    let startTs = 0
    let mounted = true

    const animate = (ts) => {
      if (!mounted) return
      rafId = requestAnimationFrame(animate)

      if (!startTs) startTs = ts
      const t = (ts - startTs) / 400
      const clamped = Math.min(1, Math.max(0, t))
      const eased = easeOutCubic(clamped)
      mesh.scale.setScalar(eased)
      if (clamped >= 1 && !hasPoppedIn) setHasPoppedIn(true)

      controls.update()
      renderer.render(scene, camera)
    }

    rafId = requestAnimationFrame(animate)

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !camera) return
      const c = containerRef.current
      const w = c.clientWidth
      const h = c.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    window.addEventListener('resize', onResize)

    return () => {
      mounted = false
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(rafId)
      controls.dispose()
      geometry.dispose()
      placeholderMaterial.dispose()
      if (rendererRef.current?.domElement) {
        rendererRef.current.domElement.remove()
      }
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.filter = dimmed ? 'brightness(0.5)' : 'brightness(1)'
  }, [dimmed])

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTapTsRef.current < 500) return
    lastTapTsRef.current = now
    onTap?.()
  }

  return (
    <div
      className="relative w-full h-full select-none touch-manipulation"
      ref={containerRef}
      onClick={handleTap}
      onTouchEnd={handleTap}
      role="button"
      tabIndex={0}
      aria-label="Model viewer"
    >
      {/* The renderer's canvas is appended into this container */}

      {/* Floating label */}
      <div className="absolute top-4 left-4 z-10">
        <div className="px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm text-white text-xs font-mono">
          {artifactLabel}
        </div>
      </div>

      {/* Bottom hint */}
      {!dimmed && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-2 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm text-white text-xs animate-pulse">
            Tap to learn more
          </div>
        </div>
      )}
    </div>
  )
}

