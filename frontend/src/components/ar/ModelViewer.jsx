import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

/**
 * ModelViewer — interactive placeholder 3D model with OrbitControls.
 *
 * Props:
 * - artifactLabel: string shown at the top
 * - dimmed: boolean; when true we reduce model brightness + scale to fit behind the info sheet
 * - onTap: called only on a real press/tap (swipes/rotations do not trigger onTap)
 */
export default function ModelViewer({ artifactLabel, dimmed = false, onTap }) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const canvasRef = useRef(null)
  const meshRef = useRef(null)

  const [hasPoppedIn, setHasPoppedIn] = useState(false)

  // Final scales chosen so the placeholder fits on mobile and stays visible behind the info sheet.
  const viewScaleFinal = 0.68
  const infoScaleFinal = 0.48

  const dimmedRef = useRef(dimmed)
  useEffect(() => {
    dimmedRef.current = dimmed
    const mesh = meshRef.current
    if (!mesh) return
    mesh.scale.setScalar(dimmed ? infoScaleFinal : viewScaleFinal)
  }, [dimmed])

  const placeholderMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x1d9e75,
      metalness: 0.4,
      roughness: 0.3,
    })
  }, [])

  const tapGestureRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    startTs: 0,
    moved: false,
  })

  const resetTapGesture = () => {
    tapGestureRef.current.pointerId = null
    tapGestureRef.current.moved = false
  }

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    tapGestureRef.current.pointerId = e.pointerId
    tapGestureRef.current.startX = e.clientX
    tapGestureRef.current.startY = e.clientY
    tapGestureRef.current.startTs = Date.now()
    tapGestureRef.current.moved = false
  }

  const handlePointerMove = (e) => {
    const st = tapGestureRef.current
    if (st.pointerId === null || e.pointerId !== st.pointerId) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    const dist = Math.hypot(dx, dy)
    // Distance threshold avoids treating rotate/swipe gestures as taps.
    if (dist > 18) st.moved = true
  }

  const handlePointerUp = (e) => {
    const st = tapGestureRef.current
    if (st.pointerId === null || e.pointerId !== st.pointerId) return
    const durationMs = Date.now() - st.startTs
    const shouldTap = !st.moved && durationMs < 380
    resetTapGesture()
    if (shouldTap) onTap?.()
  }

  const handlePointerCancel = () => resetTapGesture()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    // Transparent canvas so the live camera feed remains visible.
    renderer.setClearColor('#0a0a0f', 0)

    rendererRef.current = renderer
    container.appendChild(renderer.domElement)
    canvasRef.current = renderer.domElement

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100)
    camera.position.set(0, 0.12, 2.7)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minDistance = 1.0
    controls.maxDistance = 4.0
    controls.autoRotate = true
    controls.autoRotateSpeed = 1.5

    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 1.2)
    directional.position.set(5, 5, 5)
    scene.add(directional)

    const geometry = new THREE.TorusKnotGeometry(0.55, 0.16, 128, 14)
    const mesh = new THREE.Mesh(geometry, placeholderMaterial)
    meshRef.current = mesh
    scene.add(mesh)

    // Start scale at 0 for pop-in animation.
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

      const targetScale = dimmedRef.current ? infoScaleFinal : viewScaleFinal
      const popFactor = hasPoppedIn ? 1 : eased
      mesh.scale.setScalar(targetScale * popFactor)

      controls.update()
      renderer.render(scene, camera)

      if (clamped >= 1 && !hasPoppedIn) setHasPoppedIn(true)
    }

    rafId = requestAnimationFrame(animate)

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current) return
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
      if (rendererRef.current?.domElement) rendererRef.current.domElement.remove()
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.filter = dimmed ? 'brightness(0.85)' : 'brightness(1)'
    // Shift only the 3D render layer; keep UI overlays (title/hints) fixed in place.
    canvas.style.transform = dimmed ? 'translateY(-20vh)' : 'translateY(0)'
    canvas.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
  }, [dimmed])

  return (
    <div
      className="relative w-full h-full select-none touch-manipulation"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role="button"
      tabIndex={0}
      aria-label="Model viewer"
      style={{
        touchAction: 'none',
      }}
    >
      {/* Floating label — fixed offset; do not tie position to `dimmed` (avoids jump when sheet opens). */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
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

