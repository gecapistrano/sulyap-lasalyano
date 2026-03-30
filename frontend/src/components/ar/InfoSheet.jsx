import { useMemo } from 'react'

/**
 * InfoSheet — slide-up bottom sheet (58vh) with a fixed header and scrollable content.
 *
 * Props:
 * - artifact: detection object (artifactInfo used for content)
 * - onDragHandleTap: optional handler (currently unused)
 */
export default function InfoSheet({ artifact }) {
  const info = artifact?.artifactInfo

  const confidenceLabel = useMemo(() => {
    const confidence = typeof artifact?.confidence === 'number' ? artifact.confidence : 0
    return `${Math.round(confidence * 100)}% match`
  }, [artifact?.confidence])

  if (!info) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div
        className="h-[58vh] bg-[#0f1117]/95 backdrop-blur-md border border-white/10 rounded-t-3xl overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="pt-3 pb-2">
          <div className="w-10 h-1 bg-white/30 rounded-full mx-auto" />
        </div>

        {/* Fixed header */}
        <div className="px-6 pb-3 pt-2 border-t border-white/10 border-b border-white/10">
          <div className="text-green-400 text-xs uppercase tracking-widest">{info.president}</div>
          <div className="mt-1 text-white text-xl font-bold leading-tight">{info.name}</div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="text-sm text-white/50">{info.year}</div>
            <div className="px-3 py-1 rounded-full bg-green-400/10 border border-green-400/25 text-green-400 text-xs font-semibold">
              {confidenceLabel}
            </div>
          </div>
        </div>

        {/* Content area with fade mask at the top */}
        <div className="relative flex-1 overflow-hidden">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0f1117] to-transparent" />

          <div className="h-full overflow-y-auto px-6 pt-3">
            <div className="text-white/90 leading-relaxed text-sm">
              {info.description}
            </div>

            <div className="mt-5">
              <div className="text-white font-semibold text-sm tracking-wide uppercase text-white/90">
                Historical Context
              </div>
              <div className="mt-2 text-white/80 leading-relaxed text-sm">{info.historical_context}</div>
            </div>

            <div className="h-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

