import { useEffect, useRef, useState } from 'react'

const MOCK_ARTIFACT = {
  label: 'Presidential Trophy',
  confidence: 0.94,
  artifactInfo: {
    name: 'Presidential Achievement Trophy',
    president: 'Dr. Emilio Aguinaldo',
    year: '1998',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis.',
    historical_context:
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur adipisci velit.',
  },
}

/**
 * ARCamera — live rear camera feed with a single "Simulate Detection" CTA.
 *
 * Props:
 * - onDetection({label, confidence, artifactInfo}) is called when the user taps the button.
 */
export default function ARCamera({ onDetection, showControls = true }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraState, setCameraState] = useState('idle') // idle | requesting | granted | denied | unsupported | error

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unsupported')
        return
      }

      setCameraState('requesting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          // Best-effort autoplay. Some browsers may require a user gesture.
          video.play().catch(() => {})
        }
        setCameraState('granted')
      } catch (err) {
        if (cancelled) return
        const name = err?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') setCameraState('denied')
        else setCameraState('error')
      }
    }

    start()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  const handleSimulate = () => {
    onDetection?.(MOCK_ARTIFACT)
  }

  return (
    <div
      className="relative w-full h-full"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
      }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Camera overlay (only visible on errors/denials) */}
      {cameraState !== 'granted' && cameraState !== 'requesting' && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4 text-white/90 text-sm text-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 2,
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          {cameraState === 'denied'
            ? 'Camera permission denied. Please enable camera access in your browser settings.'
            : cameraState === 'unsupported'
              ? 'Camera is not supported in this browser.'
              : 'Camera access failed. Please try again.'}
        </div>
      )}

      {/* CTA (only in SCANNING state) */}
      {showControls && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-20 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleSimulate}
            className="rounded-full bg-black/60 px-6 py-3 text-white font-semibold shadow-lg border border-white/10"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              borderRadius: 9999,
              padding: '12px 24px',
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Simulate Detection
          </button>

          <p
            className="text-xs text-white/90 font-mono tracking-widest uppercase"
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: 12,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            Point camera at an artifact
          </p>
        </div>
      )}
    </div>
  )
}

