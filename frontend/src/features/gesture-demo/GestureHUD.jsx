import { useState } from 'react'
import { GESTURE_LABELS } from './useGestureDetector'

const GUIDE_LINES = [
  { key: 'POINTER_ORBIT', label: GESTURE_LABELS.POINTER_ORBIT },
  { key: 'ZOOM', label: '🤏 Pinch to zoom in or out' },
  { key: 'NAV', label: '🖐 Open palm and swipe left or right to switch items' },
  { key: 'INFO', label: GESTURE_LABELS.INFO_TOGGLE },
]

function controlLabel(detectorMode) {
  switch (detectorMode) {
    case 'DRAG':
      return { text: 'DRAG', color: 'text-emerald-300', border: 'border-emerald-400/50', bg: 'bg-emerald-500/15' }
    case 'ZOOM':
      return { text: 'ZOOM', color: 'text-sky-300', border: 'border-sky-400/55', bg: 'bg-sky-500/15' }
    case 'INFO_TOGGLE':
      return { text: 'TOGGLE', color: 'text-orange-300', border: 'border-orange-400/50', bg: 'bg-orange-500/15' }
    case 'SWITCH':
      return { text: 'SWITCH', color: 'text-amber-200', border: 'border-amber-400/50', bg: 'bg-amber-500/15' }
    case 'NULL':
      return { text: 'IDLE', color: 'text-white/90', border: 'border-white/35', bg: 'bg-white/10' }
    case 'NONE':
      return { text: 'IDLE', color: 'text-white/55', border: 'border-white/20', bg: 'bg-black/40' }
    default:
      return { text: '—', color: 'text-white/55', border: 'border-white/20', bg: 'bg-black/40' }
  }
}

export default function GestureHUD({
  currentIndex,
  totalCount,
  artifactName,
  hasHand,
  detectorMode,
}) {
  const [showGuide, setShowGuide] = useState(true)
  const ctrl = controlLabel(detectorMode)

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-12 sm:pt-14">
        <h1 className="max-w-[min(90vw,42rem)] text-center text-2xl font-bold tracking-tight text-white drop-shadow-md sm:text-3xl">
          {artifactName}
        </h1>
      </div>

      <div
        className={`pointer-events-none fixed right-4 top-4 z-40 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm ${ctrl.border} ${ctrl.bg} ${ctrl.color}`}
      >
        {ctrl.text}
      </div>

      <div className="fixed bottom-6 left-4 z-40 max-w-xs">
        <button
          type="button"
          className="text-left text-[11px] text-white/50 transition-colors hover:text-white/75"
          onClick={() => setShowGuide((v) => !v)}
        >
          ✋ Use hand gestures to navigate
        </button>
        {showGuide ? (
          <div className="mt-2 rounded-xl border border-white/15 bg-black/55 px-3 py-2.5 text-[11px] leading-snug text-white/65 backdrop-blur-sm">
            {GUIDE_LINES.map(({ key, label }) => (
              <div key={key} className="border-b border-white/10 py-1 last:border-0 last:pb-0 first:pt-0">
                {label}
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-1 text-[10px] text-white/35">
          {currentIndex + 1} / {totalCount} · {hasHand ? 'Hand detected' : 'No hand'}
        </p>
      </div>
    </>
  )
}
