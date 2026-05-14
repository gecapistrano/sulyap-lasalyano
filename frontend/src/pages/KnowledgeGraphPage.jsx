/**
 * KnowledgeGraphPage — mock interactive graph for presentation (pan + zoom only; nodes not clickable yet).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import './KnowledgeGraphPage.css'

/** Demo nodes (logical coordinates inside the SVG viewBox). */
const NODES = [
  { id: 'a', x: 200, y: 220, r: 32, label: 'AEA-IRC' },
  { id: 'b', x: 480, y: 140, r: 26, label: 'RD301' },
  { id: 'c', x: 720, y: 260, r: 26, label: 'RD204' },
  { id: 'd', x: 520, y: 420, r: 28, label: 'President' },
  { id: 'e', x: 280, y: 460, r: 24, label: '1987' },
  { id: 'f', x: 900, y: 180, r: 22, label: 'Cavite' },
  { id: 'g', x: 640, y: 560, r: 26, label: 'Memorabilia' },
  { id: 'h', x: 360, y: 320, r: 20, label: 'DLSU-D' },
]

const EDGES = [
  ['a', 'b'],
  ['a', 'h'],
  ['b', 'c'],
  ['b', 'd'],
  ['d', 'e'],
  ['d', 'g'],
  ['c', 'f'],
  ['h', 'e'],
  ['g', 'e'],
  ['a', 'g'],
]

const SVG_W = 1100
const SVG_H = 700

const NODE_MAP = Object.fromEntries(NODES.map((n) => [n.id, n]))

const MIN_SCALE = 0.35
const MAX_SCALE = 2.2

export default function KnowledgeGraphPage({ language, onBack, darkMode }) {
  const viewportRef = useRef(null)
  const dragRef = useRef(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(0.72)

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    const el = viewportRef.current
    el?.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      pan0x: pan.x,
      pan0y: pan.y,
      c0x: e.clientX,
      c0y: e.clientY,
    }
  }, [pan.x, pan.y])

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    setPan({
      x: d.pan0x + (e.clientX - d.c0x),
      y: d.pan0y + (e.clientY - d.c0y),
    })
  }, [])

  const endDrag = useCallback((e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
      try {
        viewportRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* not captured */
      }
    }
  }, [])

  const applyWheelZoom = useCallback((e) => {
    e.preventDefault()
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vx = e.clientX - rect.left
    const vy = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    setScale((prevScale) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * factor))
      setPan((prevPan) => {
        const worldX = (vx - prevPan.x) / prevScale
        const worldY = (vy - prevPan.y) / prevScale
        return {
          x: vx - worldX * nextScale,
          y: vy - worldY * nextScale,
        }
      })
      return nextScale
    })
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const wheel = (ev) => applyWheelZoom(ev)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [applyWheelZoom])

  const zoomBy = useCallback((delta) => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vx = rect.width / 2
    const vy = rect.height / 2
    setScale((prevScale) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale + delta))
      setPan((prevPan) => {
        const worldX = (vx - prevPan.x) / prevScale
        const worldY = (vy - prevPan.y) / prevScale
        return {
          x: vx - worldX * nextScale,
          y: vy - worldY * nextScale,
        }
      })
      return nextScale
    })
  }, [])

  return (
    <div className={`kg-root${darkMode ? ' kg-dark' : ''}`}>
      <header className="kg-header">
        <button type="button" className="kg-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="kg-header-title">Knowledge Graph</h1>
        <div className="kg-header-spacer" aria-hidden />
      </header>

      <p className="kg-sub">
        Drag to pan · Scroll to zoom · Nodes are preview-only (not clickable yet)
      </p>

      <div className="kg-viewport-wrap">
        <div
          ref={viewportRef}
          className="kg-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="application"
          aria-label="Interactive knowledge graph preview. Drag to pan and scroll to zoom."
        >
          <div
            className="kg-canvas"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <svg
              className="kg-svg"
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              width={SVG_W}
              height={SVG_H}
              aria-hidden
            >
              <rect className="kg-svg-bg" x="0" y="0" width={SVG_W} height={SVG_H} rx="12" />
              {EDGES.map(([from, to], i) => {
                const a = NODE_MAP[from]
                const b = NODE_MAP[to]
                if (!a || !b) return null
                return (
                  <line
                    key={`${from}-${to}-${i}`}
                    className="kg-edge"
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                )
              })}
              {NODES.map((n) => (
                <g key={n.id} className="kg-node-group">
                  <circle className="kg-node" cx={n.x} cy={n.y} r={n.r} />
                  <text className="kg-node-label" x={n.x} y={n.y + 4} textAnchor="middle">
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="kg-zoom-tools" aria-label="Zoom controls">
          <button type="button" className="kg-zoom-btn" onClick={() => zoomBy(0.12)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="kg-zoom-btn" onClick={() => zoomBy(-0.12)} aria-label="Zoom out">
            −
          </button>
        </div>
      </div>

      <footer className="kg-footer">
        <span className="kg-footer-lang">{language}</span>
        <span className="kg-footer-note">Mock data for demonstration</span>
      </footer>
    </div>
  )
}
