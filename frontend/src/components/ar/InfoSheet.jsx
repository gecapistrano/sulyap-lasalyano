import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

/**
 * InfoSheet — slide-up bottom sheet (58vh) with a fixed header and scrollable content.
 *
 * Props:
 * - artifact: detection object (artifactInfo used for content)
 * - onClose: called when the user swipes down far enough or closes via exit/backdrop
 */
export default function InfoSheet({ artifact, onClose }) {
  const info = artifact?.artifactInfo

  const sheetRef = useRef(null)
  const scrollRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)

  const confidenceLabel = useMemo(() => {
    const confidence = typeof artifact?.confidence === 'number' ? artifact.confidence : 0
    return `${Math.round(confidence * 100)}% match`
  }, [artifact?.confidence])

  /** Single paragraph: collapse internal newlines so layout is one block of body text. */
  const descriptionParagraph = useMemo(() => {
    const raw = typeof info?.description === 'string' ? info.description : ''
    return raw.replace(/\s+/g, ' ').trim()
  }, [info?.description])

  const syncScrollFades = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const edge = 8
    setShowTopFade(scrollTop > edge)
    // More content below when not scrolled to bottom (1px tolerance for subpixel).
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 1)
  }, [])

  useLayoutEffect(() => {
    syncScrollFades()
    const el = scrollRef.current
    if (!el) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncScrollFades) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [syncScrollFades, info])

  if (!info) return null

  const close = () => {
    setIsClosing(true)
    setDragY(0)
    window.setTimeout(() => {
      onClose?.()
    }, 350)
  }

  const handleDragStart = (e) => {
    if (isClosing) return
    e.stopPropagation()
    e.preventDefault()

    const sheet = sheetRef.current
    const sheetH = sheet?.getBoundingClientRect?.().height ?? 320
    const maxDrag = sheetH * 0.9
    const closeThreshold = Math.max(110, sheetH * 0.35)

    const startY = e.clientY
    let lastDy = 0

    setIsDragging(true)
    setDragY(0)

    const onMove = (ev) => {
      const dy = Math.max(0, ev.clientY - startY)
      lastDy = Math.min(dy, maxDrag)
      setDragY(lastDy)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setIsDragging(false)

      if (lastDy >= closeThreshold) close()
      else setDragY(0)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  const transformStyle =
    isClosing ? 'translateY(100%)' : dragY > 0 ? `translateY(${dragY}px)` : undefined

  const transitionStyle =
    isDragging || dragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
      <div
        ref={sheetRef}
        className="flex h-[58vh] min-h-0 flex-col bg-[#0f1117]/95 backdrop-blur-md border border-white/10 rounded-t-3xl overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
        style={{
          transform: transformStyle,
          transition: transformStyle ? transitionStyle : undefined,
          touchAction: 'pan-y',
          pointerEvents: isClosing ? 'none' : undefined,
        }}
      >
        {/* Drag handle */}
        <div className="shrink-0 pt-3 pb-2">
          <div
            className="w-10 h-1 bg-white/30 rounded-full mx-auto touch-manipulation"
            onPointerDown={handleDragStart}
          />
        </div>

        {/* Fixed header */}
        <div className="shrink-0 px-6 pb-3 pt-2 border-t border-white/10 border-b border-white/10">
          <div className="text-green-400 text-xs uppercase tracking-widest">{info.president}</div>
          <div className="mt-1 text-white text-xl font-bold leading-tight">{info.name}</div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="text-sm text-white/50">{info.year}</div>
            <div className="px-3 py-1 rounded-full bg-green-400/10 border border-green-400/25 text-green-400 text-xs font-semibold">
              {confidenceLabel}
            </div>
          </div>
        </div>

        {/* Scroll region + scroll-linked edge fades */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={syncScrollFades}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-4"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
            }}
          >
            <p className="text-white/90 leading-relaxed text-sm">{descriptionParagraph}</p>

            <section className="mt-6">
              <h3 className="text-white font-semibold text-sm tracking-wide uppercase text-white/90">
                Historical Context
              </h3>
              <p className="mt-2 text-white/80 leading-relaxed text-sm whitespace-pre-wrap">
                {info.historical_context}
              </p>
            </section>
          </div>

          <div
            className="pointer-events-none absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-[#0f1117] to-transparent transition-opacity duration-200"
            style={{ opacity: showTopFade ? 1 : 0 }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-[#0f1117] to-transparent transition-opacity duration-200"
            style={{ opacity: showBottomFade ? 1 : 0 }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
