/**
 * Locked-detection AR outlines on the camera feed.
 * Green “DETECTED!” label; follows the object; hidden when it leaves the frame.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { mapModelBoxToOverlayPercent } from '../../lib/rdClassifier'

function isMostlyOnScreen(mapped) {
  if (!mapped) return false
  const right = mapped.left + mapped.width
  const bottom = mapped.top + mapped.height
  // Disappear once the box is largely outside the viewport.
  if (right < 4 || bottom < 4 || mapped.left > 96 || mapped.top > 96) return false
  if (mapped.width < 2 || mapped.height < 2) return false
  return true
}

export default function DetectionOverlay({
  detections = [],
  videoRef,
  zoom = 1,
  onSelect,
  detectedLabelTemplate = '{code} DETECTED!',
  tapHint = 'Tap to view',
}) {
  const rootRef = useRef(null)
  const [layoutTick, setLayoutTick] = useState(0)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => setLayoutTick((n) => n + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // layoutTick forces remap when overlay size changes
  void layoutTick

  return (
    <div ref={rootRef} className="ar-detect-overlay" aria-live="polite">
      {detections.map((det) => {
        const video = videoRef?.current
        const host = rootRef.current
        const mapped =
          video && host
            ? mapModelBoxToOverlayPercent(det.box, video, host, zoom)
            : null
        if (!isMostlyOnScreen(mapped)) return null

        const code = det.className || 'Item'
        const detectedLine = detectedLabelTemplate.replaceAll('{code}', code)
        const aria = `${detectedLine} ${tapHint}`

        return (
          <button
            key={det.trackId || det.id || `${code}-${mapped.left.toFixed(1)}-${mapped.top.toFixed(1)}`}
            type="button"
            className="ar-detect-outline ar-detect-outline--locked"
            style={{
              left: `${mapped.left}%`,
              top: `${mapped.top}%`,
              width: `${mapped.width}%`,
              height: `${mapped.height}%`,
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelect?.(det)
            }}
            aria-label={aria}
          >
            <span className="ar-detect-outline__ring" aria-hidden />
            <span className="ar-detect-outline__corners" aria-hidden>
              <i className="c c-tl" />
              <i className="c c-tr" />
              <i className="c c-bl" />
              <i className="c c-br" />
            </span>
            <span className="ar-detect-outline__banner">
              <span className="ar-detect-outline__banner-code">{detectedLine}</span>
              <span className="ar-detect-outline__banner-hint">{tapHint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
