import { useCallback, useRef } from 'react'
import { useMediaPipeHands } from './useMediaPipeHands'

/**
 * @param {boolean} [autoStartCamera] — false = show "Enable camera" first so `getUserMedia` runs in a click handler
 *   (fixes denied camera after SPA navigation on Safari / production hosts like Vercel).
 */
export default function GestureCamera({
  onLandmarks,
  onHasHandChange,
  captureMode = 'quality',
  autoStartCamera = true,
}) {
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
    autoStartCamera,
  })

  const handleEnableClick = () => {
    void startTracking()
  }

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

      {!autoStartCamera && !isLoading && !error ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6">
          <div className="max-w-md rounded-2xl border border-white/15 bg-black/70 p-6 text-center shadow-xl backdrop-blur-md">
            <p className="mb-1 text-base font-semibold text-white">Enable camera for hand tracking</p>
            <p className="mb-5 text-sm text-white/70">
              Tap below so your browser can open the camera in this step (same idea as the scanner’s “Enable
              Camera”). Required on some devices after you open this view from the menu.
            </p>
            <button
              type="button"
              onClick={handleEnableClick}
              className="rounded-full border border-emerald-400/50 bg-emerald-600/90 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-500"
            >
              Enable camera
            </button>
          </div>
        </div>
      ) : null}

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
            {!autoStartCamera ? (
              <button
                type="button"
                onClick={handleEnableClick}
                className="mt-4 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
