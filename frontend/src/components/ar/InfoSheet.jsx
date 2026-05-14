import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

/**
 * InfoSheet — slide-up bottom sheet (62vh) with a fixed header and scrollable content.
 *
 * Props:
 * - artifact: detection object (artifactInfo used for content)
 * - onClose: called when the user swipes down far enough or closes via exit/backdrop
 * - onDragProgress: called with 0–1 during drag (0 = fully open, 1 = fully closed)
 */
export default function InfoSheet({ artifact, darkMode, onClose, onDragProgress }) {
  const info = artifact?.artifactInfo

  const sheetRef = useRef(null)
  const scrollRef = useRef(null)
  const animDoneRef = useRef(false)
  const closingRef = useRef(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)

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

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const onEnd = () => {
      animDoneRef.current = true
      sheet.style.animation = 'none'
      sheet.style.transform = 'translateY(0)'
    }
    sheet.addEventListener('animationend', onEnd, { once: true })
    return () => sheet.removeEventListener('animationend', onEnd)
  }, [])

  if (!info) return null

  const close = () => {
    if (closingRef.current) return
    closingRef.current = true
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
      sheet.style.transform = 'translateY(100%)'
    }
    onDragProgress?.(1)
    window.setTimeout(() => onClose?.(), 350)
  }

  const handleDragStart = (startClientY, fromScroll = false) => {
    if (closingRef.current) return
    if (fromScroll) {
      const el = scrollRef.current
      if (el && el.scrollTop > 5) return
    }

    const sheet = sheetRef.current
    if (!sheet) return

    if (!animDoneRef.current) {
      animDoneRef.current = true
      sheet.style.animation = 'none'
    }

    const sheetH = sheet.getBoundingClientRect().height || 320
    const maxDrag = sheetH * 0.9
    const closeThreshold = Math.max(80, sheetH * 0.25)

    sheet.style.transition = 'none'
    sheet.style.transform = 'translateY(0)'

    const startY = startClientY
    let lastDy = 0
    let didMove = false

    const applyDrag = (clientY) => {
      const dy = clientY - startY
      if (dy <= 0) {
        if (lastDy !== 0) {
          lastDy = 0
          sheet.style.transform = 'translateY(0)'
          onDragProgress?.(0)
        }
        return
      }
      didMove = true
      lastDy = Math.min(dy, maxDrag)
      sheet.style.transform = `translateY(${lastDy}px)`
      onDragProgress?.(lastDy / sheetH)
    }

    const finish = () => {
      window.removeEventListener('mousemove', onMouseMove, true)
      window.removeEventListener('mouseup', onMouseUp, true)
      window.removeEventListener('touchmove', onTouchMove, true)
      window.removeEventListener('touchend', onTouchEnd, true)
      window.removeEventListener('touchcancel', onTouchEnd, true)

      sheet.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'

      if (didMove && lastDy >= closeThreshold) {
        close()
      } else {
        sheet.style.transform = 'translateY(0)'
        onDragProgress?.(0)
      }
    }

    const onMouseMove = (ev) => { ev.preventDefault(); applyDrag(ev.clientY) }
    const onMouseUp = () => finish()
    const onTouchMove = (ev) => { if (ev.touches[0]) applyDrag(ev.touches[0].clientY) }
    const onTouchEnd = () => finish()

    window.addEventListener('mousemove', onMouseMove, true)
    window.addEventListener('mouseup', onMouseUp, { once: true, capture: true })
    window.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    window.addEventListener('touchend', onTouchEnd, { once: true, capture: true })
    window.addEventListener('touchcancel', onTouchEnd, { once: true, capture: true })
  }

  const onMouseDrag = (e) => { e.preventDefault(); handleDragStart(e.clientY) }
  const onTouchDrag = (e, fromScroll = false) => {
    const t = e.touches[0]
    if (t) { e.preventDefault(); handleDragStart(t.clientY, fromScroll) }
  }

  const bg = darkMode ? 'bg-[#3a2e1f]/85' : 'bg-[#f2efd6]/75'
  const borderT = darkMode ? 'border-[#5a4a38]/30' : 'border-[#d4c8a8]/30'
  const handle = darkMode ? 'bg-[#d4c8a8]/30' : 'bg-[#5a4a38]/30'
  const borderB = darkMode ? 'border-[#d4c8a8]/15' : 'border-[#5a4a38]/15'
  const labelColor = darkMode ? 'text-[#d4c8a8]' : 'text-[#7a6a55]'
  const titleColor = darkMode ? 'text-[#f2efd6]' : 'text-[#3a2e1f]'
  const subColor = darkMode ? 'text-[#d4c8a8]/70' : 'text-[#5a4a38]/70'
  const bodyColor = darkMode ? 'text-[#f2efd6]/85' : 'text-[#3a2e1f]/85'
  const bodyLight = darkMode ? 'text-[#f2efd6]/75' : 'text-[#3a2e1f]/75'
  const sectionHead = darkMode ? 'text-[#d4c8a8]' : 'text-[#5a4a38]'
  const photoBorder = darkMode ? 'border-[#d4c8a8]/20' : 'border-[#5a4a38]/20'
  const photoBg = darkMode ? 'bg-[#5a4a38]/30' : 'bg-[#d4c8a8]/30'
  const photoStroke = darkMode ? '#d4c8a8' : '#5a4a38'
  const fadeFrom = darkMode ? 'from-[#3a2e1f]' : 'from-[#f2efd6]'

  return (
    <div className="fixed inset-x-0 bottom-0 z-50" onClick={(e) => e.stopPropagation()}>
      <div
        ref={sheetRef}
        className={`flex h-[62vh] min-h-0 flex-col ${bg} backdrop-blur-xl border-t ${borderT} rounded-t-3xl overflow-hidden animate-slide-up`}
        role="dialog"
        aria-modal="true"
        style={{ touchAction: 'none' }}
      >
        {/* Drag handle */}
        <div
          className="shrink-0 pt-3 pb-2 cursor-grab select-none"
          onMouseDown={onMouseDrag}
          onTouchStart={onTouchDrag}
        >
          <div className={`w-10 h-1 ${handle} rounded-full mx-auto`} />
        </div>

        {/* Fixed header */}
        <div
          className={`shrink-0 px-6 pb-3 pt-2 border-b ${borderB} cursor-grab select-none`}
          onMouseDown={onMouseDrag}
          onTouchStart={onTouchDrag}
        >
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <div className={`${labelColor} text-xs font-bold uppercase tracking-widest`}>{info.president}</div>
              <div className={`mt-1 ${titleColor} text-xl font-bold leading-tight`}>{info.name}</div>
              <div className="mt-2">
                <div className={`text-sm font-bold ${subColor}`}>{info.year}</div>
              </div>
            </div>
            <div className={`shrink-0 w-24 h-24 rounded-lg border ${photoBorder} ${photoBg} overflow-hidden flex items-center justify-center`}>
              {info.president_photo
                ? <img src={info.president_photo} alt={info.president} className="w-full h-full object-cover" />
                : <svg viewBox="0 0 24 24" fill="none" stroke={photoStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 opacity-40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              }
            </div>
          </div>
        </div>

        {/* Scroll region */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={syncScrollFades}
            onMouseDown={(e) => { e.preventDefault(); handleDragStart(e.clientY, true) }}
            onTouchStart={(e) => onTouchDrag(e, true)}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-4"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
            }}
          >
            <p className={`${bodyColor} leading-relaxed text-sm font-semibold`}>{descriptionParagraph}</p>

            <section className="mt-6">
              <h3 className={`${sectionHead} font-bold text-sm tracking-wide uppercase`}>
                Historical Context
              </h3>
              <p className={`mt-2 ${bodyLight} leading-relaxed text-sm font-semibold whitespace-pre-wrap`}>
                {info.historical_context}
              </p>
            </section>
          </div>

          <div
            className={`pointer-events-none absolute top-0 left-0 right-0 h-14 bg-gradient-to-b ${fadeFrom} to-transparent transition-opacity duration-200`}
            style={{ opacity: showTopFade ? 1 : 0 }}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t ${fadeFrom} to-transparent transition-opacity duration-200`}
            style={{ opacity: showBottomFade ? 1 : 0 }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
