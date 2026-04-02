import { useCallback, useEffect, useRef, useState } from 'react'
import '@mediapipe/hands'
import '@mediapipe/camera_utils'
import '@mediapipe/drawing_utils'
import { getDetectorMode } from './handPointing'

const DETECTOR_COLORS = {
  NONE: { line: 'rgba(255,255,255,0.35)', point: 'rgba(255,255,255,0.45)' },
  NULL: { line: 'rgba(255,255,255,0.58)', point: 'rgba(255,255,255,0.72)' },
  SWITCH: { line: 'rgba(250, 204, 21, 0.58)', point: 'rgba(253, 224, 71, 0.9)' },
  INFO_TOGGLE: { line: 'rgba(251, 146, 60, 0.68)', point: 'rgba(253, 186, 116, 0.92)' },
  ZOOM: { line: 'rgba(59, 130, 246, 0.62)', point: 'rgba(147, 197, 253, 0.9)' },
  DRAG: { line: 'rgba(34, 197, 94, 0.48)', point: 'rgba(74, 222, 128, 0.85)' },
}

/**
 * @param {object} opts
 * @param {boolean} [opts.autoStartCamera] — if false, call `startTracking()` from a button `onClick` so
 *   `getUserMedia` runs inside a user gesture (required on many browsers after SPA navigation; fixes Vercel).
 */
export function useMediaPipeHands({
  videoRef,
  canvasRef,
  onLandmarks,
  captureMode = 'quality',
  autoStartCamera = true,
}) {
  const [isLoading, setIsLoading] = useState(autoStartCamera)
  const [hasHand, setHasHand] = useState(false)
  const [error, setError] = useState(null)

  const onLandmarksRef = useRef(onLandmarks)
  const cameraRef = useRef(null)
  const handsRef = useRef(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    onLandmarksRef.current = onLandmarks
  }, [onLandmarks])

  const stopTracking = useCallback(() => {
    cancelledRef.current = true
    setHasHand(false)
    onLandmarksRef.current?.(null, { detectorMode: 'NONE' })
    if (cameraRef.current) {
      try {
        cameraRef.current.stop()
      } catch {
        /* ignore */
      }
      cameraRef.current = null
    }
    if (handsRef.current) {
      try {
        handsRef.current.close()
      } catch {
        /* ignore */
      }
      handsRef.current = null
    }
  }, [])

  const startTracking = useCallback(async () => {
    const videoEl = videoRef?.current
    const canvasEl = canvasRef?.current
    if (!videoEl || !canvasEl) {
      setIsLoading(false)
      setError('Camera preview is not ready yet. Close this screen and try again.')
      return
    }

    stopTracking()
    cancelledRef.current = false
    setError(null)
    setIsLoading(true)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support camera access (getUserMedia).')
      setIsLoading(false)
      return
    }

    try {
      const mp = globalThis
      const HandsClass = mp.Hands
      const CameraClass = mp.Camera
      const drawConnectors = mp.drawConnectors
      const drawLandmarks = mp.drawLandmarks
      const handConnections = mp.HAND_CONNECTIONS
      if (!HandsClass || !CameraClass || !drawConnectors || !drawLandmarks || !handConnections) {
        throw new Error('MediaPipe runtime did not load correctly.')
      }

      const hands = new HandsClass({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      })
      handsRef.current = hands

      const fastMode = captureMode === 'fast'
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: fastMode ? 0.5 : 0.6,
        minTrackingConfidence: fastMode ? 0.45 : 0.55,
      })

      hands.onResults((results) => {
        if (cancelledRef.current) return
        const v = videoRef.current
        const c = canvasRef.current
        if (!v || !c) return

        const w = v.videoWidth || v.clientWidth
        const h = v.videoHeight || v.clientHeight
        if (!w || !h) return

        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, w, h)

        const handLandmarks = results.multiHandLandmarks?.[0] ?? null
        if (handLandmarks) {
          const thumbTip = handLandmarks[4]
          const indexTip = handLandmarks[8]
          const middleTip = handLandmarks[12]
          const detectorMode = getDetectorMode(handLandmarks)
          const palette = DETECTOR_COLORS[detectorMode] ?? DETECTOR_COLORS.NULL
          const lineColor = palette.line
          const pointColor = palette.point

          drawConnectors(ctx, handLandmarks, handConnections, {
            color: lineColor,
            lineWidth: 3,
          })
          drawLandmarks(ctx, handLandmarks, {
            color: pointColor,
            lineWidth: 1,
            radius: 3,
          })

          if (indexTip) {
            const cursorActive = detectorMode === 'DRAG'
            const x = indexTip.x * w
            const y = indexTip.y * h
            ctx.beginPath()
            ctx.arc(x, y, cursorActive ? 12 : 8, 0, Math.PI * 2)
            ctx.fillStyle = cursorActive ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255,255,255,0.12)'
            ctx.fill()

            ctx.beginPath()
            ctx.arc(x, y, cursorActive ? 6 : 4, 0, Math.PI * 2)
            ctx.fillStyle = cursorActive ? '#22c55e' : 'rgba(255,255,255,0.35)'
            ctx.fill()
          }

          if (detectorMode === 'ZOOM' && thumbTip && indexTip) {
            ;[thumbTip, indexTip].forEach((pt) => {
              ctx.beginPath()
              ctx.arc(pt.x * w, pt.y * h, 7, 0, Math.PI * 2)
              ctx.fillStyle = 'rgba(59, 130, 246, 0.95)'
              ctx.fill()
            })
          }

          if (detectorMode === 'INFO_TOGGLE' && indexTip && middleTip) {
            ;[indexTip, middleTip].forEach((pt) => {
              ctx.beginPath()
              ctx.arc(pt.x * w, pt.y * h, 6, 0, Math.PI * 2)
              ctx.fillStyle = 'rgba(251, 146, 60, 0.95)'
              ctx.fill()
            })
          }

          setHasHand(true)
          onLandmarksRef.current?.(handLandmarks, { detectorMode })
        } else {
          setHasHand(false)
          onLandmarksRef.current?.(null, { detectorMode: 'NONE' })
        }
      })

      const camera = new CameraClass(videoEl, {
        onFrame: async () => {
          if (cancelledRef.current || !handsRef.current || !videoRef.current) return
          await handsRef.current.send({ image: videoRef.current })
        },
        width: fastMode ? 640 : 960,
        height: fastMode ? 360 : 540,
      })
      cameraRef.current = camera

      await camera.start()
      const stream = videoEl.srcObject
      const track = stream?.getVideoTracks?.()?.[0]
      if (track?.applyConstraints) {
        track
          .applyConstraints({
            frameRate: fastMode ? { ideal: 60, max: 60 } : { ideal: 30, max: 30 },
          })
          .catch(() => {})
      }
      if (!cancelledRef.current) setIsLoading(false)
    } catch (err) {
      if (cancelledRef.current) return
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access to use gesture tracking.'
          : 'Unable to initialize hand tracking. Please check camera permissions and try again.',
      )
      setIsLoading(false)
    }
  }, [videoRef, canvasRef, captureMode, stopTracking])

  useEffect(() => {
    if (!autoStartCamera) {
      setIsLoading(false)
      return
    }
    const id = requestAnimationFrame(() => {
      void startTracking()
    })
    return () => cancelAnimationFrame(id)
  }, [autoStartCamera, startTracking])

  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [stopTracking])

  return { isLoading, hasHand, error, startTracking }
}
