import { useCallback, useRef } from 'react'
import { useMediaPipeHands } from './useMediaPipeHands'

export default function GestureCamera({ onLandmarks, onHasHandChange, captureMode = 'quality' }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const handleLandmarks = useCallback(
    (points, meta) => {
      onLandmarks?.(points, meta)
      onHasHandChange?.(points !== null)
    },
    [onLandmarks, onHasHandChange],
  )

  const { isLoading, error, startTracking } = useMediaPipeHands({
    videoRef,
    canvasRef,
    onLandmarks: handleLandmarks,
    captureMode,
  })

  return (
    <div className="absolute inset-0 z-10">
      <video
        ref={videoRef}
        className="h-full w-full scale-x-[-1] object-cover"
        autoPlay
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
      />

      {isLoading && !error ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55">
          <div className="flex flex-col items-center gap-3 text-white/90">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            <p className="text-sm tracking-wide">Initializing hand tracking...</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-red-300/40 bg-red-500/15 p-4 text-red-100">
            <p className="mb-2 font-semibold">Camera access is required</p>
            <p className="text-sm text-red-100/90">{error}</p>
            <button
              type="button"
              onClick={() => void startTracking()}
              className="mt-4 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
