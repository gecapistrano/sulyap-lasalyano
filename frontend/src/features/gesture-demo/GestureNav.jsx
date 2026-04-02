export default function GestureNav({ onPrev, onNext, infoOpen, showNav = true }) {
  if (infoOpen || !showNav) return null

  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        className="pointer-events-auto fixed left-4 top-1/2 z-[45] h-12 w-12 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-xl text-white shadow-lg backdrop-blur-sm transition-transform hover:bg-black/70 active:scale-90"
        aria-label="Previous artifact"
      >
        ←
      </button>
      <button
        type="button"
        onClick={onNext}
        className="pointer-events-auto fixed right-4 top-1/2 z-[45] h-12 w-12 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-xl text-white shadow-lg backdrop-blur-sm transition-transform hover:bg-black/70 active:scale-90"
        aria-label="Next artifact"
      >
        →
      </button>
    </>
  )
}
