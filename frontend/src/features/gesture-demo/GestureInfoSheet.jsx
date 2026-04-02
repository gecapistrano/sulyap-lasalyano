import { useEffect, useState } from 'react'

export default function GestureInfoSheet({ open, artifact, onClose }) {
  const [mounted, setMounted] = useState(open)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setExiting(false)
    } else if (mounted) {
      setExiting(true)
    }
  }, [open, mounted])

  useEffect(() => {
    if (open) {
      setMounted(true)
      setExiting(false)
    }
  }, [artifact?.id, open])

  useEffect(() => {
    if (!exiting) return
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (!reduce) return
    const id = window.setTimeout(() => {
      setMounted(false)
      setExiting(false)
      onClose?.()
    }, 80)
    return () => window.clearTimeout(id)
  }, [exiting, onClose])

  const handleCloseClick = () => {
    setExiting(true)
  }

  const handleAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return
    if (!exiting) return
    const name = e.animationName || ''
    if (!name.includes('slide-down')) return
    setMounted(false)
    setExiting(false)
    onClose?.()
  }

  if (!mounted) return null

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 h-[60vh] overflow-hidden rounded-t-3xl bg-[#0f1117]/95 backdrop-blur-md ${
        exiting
          ? 'animate-slide-down will-change-transform motion-reduce:translate-y-full motion-reduce:opacity-0 motion-reduce:animate-none'
          : 'animate-slide-up'
      } `}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="mx-auto mt-3 h-1 w-10 rounded-full" style={{ backgroundColor: artifact.accentColor }} />

      <div className="flex items-start justify-between px-5 pb-3 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: artifact.accentColor }}>
            {artifact.president}
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">{artifact.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2 py-1 text-xs text-white/70"
              style={{ borderColor: artifact.accentColor }}
            >
              {artifact.year}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCloseClick}
          className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/85"
        >
          Close
        </button>
      </div>

      <div className="mx-5 border-t border-white/10" />

      <div className="relative h-[calc(60vh-145px)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-[#0f1117] to-transparent" />
        <div className="h-full overflow-y-auto px-5 pb-6 pt-2">
          <h3 className="text-sm font-semibold text-white/85">Description</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/75">{artifact.description}</p>
          <div className="h-16" />
        </div>
      </div>
    </div>
  )
}
