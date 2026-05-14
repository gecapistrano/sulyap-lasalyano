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
 * - showTapHint: when false, hides the bottom “Tap to learn more” chip (e.g. browse / cabinet view).
 * - showArtifactLabel: when false, hides the top floating name chip (e.g. browse artifact detail).
 */
export default function ModelViewer({
  artifactLabel,
  dimmed = false,
  dragProgressRef,
  onTap,
  showTapHint = true,
  showArtifactLabel = true,
}) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const canvasRef = useRef(null)
  const meshRef = useRef(null)

  const [hasPoppedIn, setHasPoppedIn] = useState(false)

  // Final scales chosen so the placeholder fits on mobile and stays visible behind the info sheet.
  const viewScaleFinal = 0.68
  const infoScaleFinal = 0.48

  const dimmedRef = useRef(dimmed)
  const scaleTargetRef = useRef(dimmed ? infoScaleFinal : viewScaleFinal)
  const scaleCurrentRef = useRef(0)
  const yOffsetCurrentRef = useRef(0)
  useEffect(() => {
    dimmedRef.current = dimmed
    scaleTargetRef.current = dimmed ? infoScaleFinal : viewScaleFinal
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
    activePointers: 0,
  })

  const resetTapGesture = () => {
    tapGestureRef.current.pointerId = null
    tapGestureRef.current.moved = false
  }

  const handlePointerDown = (e) => {
    const st = tapGestureRef.current
    st.activePointers += 1
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (st.activePointers > 1) {
      st.moved = true
      return
    }
    st.pointerId = e.pointerId
    st.startX = e.clientX
    st.startY = e.clientY
    st.startTs = Date.now()
    st.moved = false
  }

  const handlePointerMove = (e) => {
    const st = tapGestureRef.current
    if (st.pointerId === null || e.pointerId !== st.pointerId) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    const dist = Math.hypot(dx, dy)
    if (dist > 18) st.moved = true
  }

  const handlePointerUp = (e) => {
    const st = tapGestureRef.current
    st.activePointers = Math.max(0, st.activePointers - 1)
    if (st.pointerId === null || e.pointerId !== st.pointerId) return
    const durationMs = Date.now() - st.startTs
    const shouldTap = !st.moved && durationMs < 380 && st.activePointers === 0
    resetTapGesture()
    if (shouldTap) onTap?.()
  }

  const handlePointerCancel = (e) => {
    tapGestureRef.current.activePointers = Math.max(0, tapGestureRef.current.activePointers - 1)
    if (tapGestureRef.current.pointerId === e.pointerId) resetTapGesture()
  }

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

      const dp = dragProgressRef?.current ?? 0
      const baseTarget = dimmedRef.current
        ? infoScaleFinal + dp * (viewScaleFinal - infoScaleFinal)
        : scaleTargetRef.current
      const popFactor = hasPoppedIn ? 1 : eased
      const desired = baseTarget * popFactor
      const current = scaleCurrentRef.current
      const lerped = current + (desired - current) * 0.12
      scaleCurrentRef.current = lerped
      mesh.scale.setScalar(lerped)

      const maxYOffset = -20
      const yTarget = dimmedRef.current ? maxYOffset * (1 - dp) : 0
      const yCurrent = yOffsetCurrentRef.current
      const yLerped = yCurrent + (yTarget - yCurrent) * 0.12
      yOffsetCurrentRef.current = yLerped
      const canvasEl = canvasRef.current
      if (canvasEl) {
        canvasEl.style.transform = `translateY(${yLerped}vh)`
      }

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
    canvas.style.transition = 'filter 0.5s ease'
  }, [dimmed])

  const viewerRole = onTap ? 'button' : 'application'
  const viewerLabel = onTap ? 'Model viewer — tap for details' : '3D model — drag to rotate'

  return (
    <div
      className="relative w-full h-full select-none touch-manipulation"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role={viewerRole}
      tabIndex={0}
      aria-label={viewerLabel}
      style={{
        touchAction: 'none',
      }}
    >
      {showArtifactLabel && artifactLabel ? (
        <div className="pointer-events-none absolute left-4 top-4 z-10">
          <div className="px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm text-white text-xs font-mono">
            {artifactLabel}
          </div>
        </div>
      ) : null}

      {/* Bottom hint (AR scan flow only) */}
      {showTapHint && !dimmed && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-2 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm text-white text-xs animate-pulse">
            Tap to learn more
          </div>
        </div>
      )}
    </div>
  )
}

