// ============================================================================
// useGestureDetector.js — React hook that turns hand landmarks into gestures.
//
// Modes detected here (must match handPointing.js):
//   ZOOM — thumb + index extended, rest curled → pinch delta drives zoom in/out
//   DRAG — only index extended, thumb tucked → model follows finger (handled by ModelStage)
//   (SWITCH and INFO_TOGGLE are handled via the existing open-palm / peace-sign logic)
//
// Zoom in/out logic:
//   While in ZOOM mode, we track the thumb–index tip distance every frame (symmetric thresholds).
//   After ZOOM_IN, pinch-in is ignored for ZOOM_POST_IN_BLOCK_OUT_MS so you can close your hand.
//   ZOOM_OUT uses a short cooldown; ZOOM_IN uses a longer cooldown before the next step.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { isNullFistPose, isInfoTogglePose } from './handPointing'

// --- Gesture labels shown in the HUD overlay --------------------------------

export const GESTURE_LABELS = {
  POINTER_ORBIT: '👆 Point index to drag item',
  ZOOM_IN: '🔎 Zoom In',
  ZOOM_OUT: '🔍 Zoom Out',
  INFO_TOGGLE: '✌ Index and middle finger together to toggle info',
  NAV_PREV: '🖐 Swipe Right: Previous',
  NAV_NEXT: '🖐 Swipe Left: Next',
}

// --- Tuning constants -------------------------------------------------------

/**
 * Pinch distance EMA factor — lower = heavier smoothing (0–1).
 * Closing the hand moves thumb/index fast; keep this low so that motion does not dump into zoom.
 */
const PINCH_DISTANCE_SMOOTH = 0.19

/**
 * Ignore per-frame pinch motion smaller than this — same rule for zoom in and zoom out.
 */
const PINCH_ZOOM_DEADBAND = 0.0036

/**
 * Integrated smoothed pinch change (either direction) before one ZOOM_IN or ZOOM_OUT step.
 * Same value keeps both directions equally responsive.
 */
const ZOOM_ACCUM_STEP = 0.034

/** Cap integrated accumulator (symmetric); must be at least ZOOM_ACCUM_STEP to fire. */
const ZOOM_ACCUM_CLAMP = 0.09

/** When motion is under the deadband, bleed the accumulator (drops stray drift). */
const ZOOM_ACCUM_DRIFT_DECAY = 0.84

/**
 * After a ZOOM_IN, pinch-in (zoom-out) is ignored for this long so you can close your hand
 * without firing ZOOM_OUT. Does not apply after ZOOM_OUT.
 */
const ZOOM_POST_IN_BLOCK_OUT_MS = 1750

/**
 * Cooldown after ZOOM_IN before another zoom step (usually another ZOOM_IN).
 * Longer = more time before the next step after zooming in.
 */
const ZOOM_STEP_COOLDOWN_IN_MS = 1050

/** Short cooldown after ZOOM_OUT so the next gesture (in or out) can follow quickly. */
const ZOOM_STEP_COOLDOWN_OUT_MS = 240

/** Minimum horizontal swipe distance (normalized) to trigger a navigation gesture. */
const SWIPE_THRESHOLD = 0.18

/** Palm center x must start in this zone for a left-to-right swipe. */
const LEFT_ZONE_MAX = 0.4

/** Palm center x must end in this zone for a left-to-right swipe. */
const RIGHT_ZONE_MIN = 0.6

/** How many consecutive frames a pose must hold before we accept it. */
const MIN_GESTURE_FRAMES = 5

/** Short cooldown so INFO_TOGGLE cannot double-fire in one gesture burst. */
const INFO_TOGGLE_COOLDOWN_MS = 320

/** How many consecutive open-palm frames before we start tracking a swipe. */
const OPEN_PALM_MIN_FRAMES = 4

/** Palm must be stable this many frames before swipe endpoints can trigger NAV. */
const OPEN_PALM_STABLE_BEFORE_NAV_FRAMES = 10

/** How many missed open-palm frames we tolerate before cancelling a swipe. */
const OPEN_PALM_GRACE_FRAMES = 4

/**
 * After the smoothed detector mode changes, block INFO / NAV / pinch zoom for this long
 * so transitional poses are not interpreted as commands.
 */
const MODE_SETTLE_MS = 480

/** Global cooldown after a gesture fires (ms) — mobile gets a longer delay. */
const GLOBAL_GESTURE_DELAY_MOBILE_MS = 1600
const GLOBAL_GESTURE_DELAY_DESKTOP_MS = 1300

// --- Nav swipe cooldown (ms) after firing -----------------------------------
const NAV_SWIPE_COOLDOWN_MS = 1400

// --- Helpers ----------------------------------------------------------------

/** Pick the right global gesture delay based on device type. */
function getGlobalGestureDelayMs() {
  // Server-side fallback
  if (typeof window === 'undefined') return GLOBAL_GESTURE_DELAY_DESKTOP_MS
  const ua = window.navigator?.userAgent ?? ''
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  // Mobile devices get a longer cooldown to avoid accidental double-fires
  return coarsePointer || mobileUa ? GLOBAL_GESTURE_DELAY_MOBILE_MS : GLOBAL_GESTURE_DELAY_DESKTOP_MS
}

/** Euclidean distance between two landmarks using only x and y (no z). */
function distance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

// --- Hook -------------------------------------------------------------------

export function useGestureDetector(landmarks, detectorModeRef, infoPanelOpenRef) {
  // Currently emitted gesture (e.g. 'ZOOM_IN', 'NAV_NEXT', null)
  const [gesture, setGesture] = useState(null)
  // Whether the hand currently looks like an open palm
  const [isOpenPalm, setIsOpenPalm] = useState(false)

  // Persistent state that survives re-renders (swipe tracking, frame counts)
  const historyRef = useRef({
    palmDrag: {          // Tracks an in-progress open-palm swipe
      active: false,     // Whether we're currently tracking a swipe
      startX: 0,         // Normalized x where the swipe started
      lastX: 0,          // Most recent normalized x
      missedFrames: 0,   // Consecutive frames where open palm was lost
      stableFrames: 0,   // Consecutive frames with open palm while active (for NAV delay)
    },
    counts: {            // Frame counters for multi-frame pose validation
      INFO_TOGGLE: 0,    // Consecutive frames of info-toggle pose
      OPEN_PALM: 0,      // Consecutive frames of open palm
      FIST: 0,           // Consecutive frames of fist/null pose
    },
  })

  // Per-gesture cooldown timestamps (prevents rapid re-firing)
  const cooldownRef = useRef({
    NAV_PREV: 0,
    NAV_NEXT: 0,
    ZOOM_IN: 0,
    ZOOM_OUT: 0,
    INFO_TOGGLE: 0,
  })

  // Global "next allowed gesture" timestamp (prevents any gesture during cooldown)
  const globalNextAllowedRef = useRef(0)
  // Cached global delay value
  const globalDelayRef = useRef(getGlobalGestureDelayMs())

  // Smoothed pinch distance + integrated delta (see STEP 7)
  const pinchZoomStateRef = useRef(null)
  // After ZOOM_IN: until this time, pinch-in does not count (close fist without zoom-out)
  const zoomOutBlockedUntilRef = useRef(0)
  // Opening the panel: only after smoothed NULL since last open (avoids accidental repeats).
  // Closing uses infoPanelOpenRef and does not require this.
  const infoToggleArmedRef = useRef(true)
  /** True while peace pose has been stable; false after leaving pose — used for edge-only toggle (no repeat while holding). */
  const infoTogglePrevStableRef = useRef(false)

  // Last smoothed mode + time when commands (not drag orbit) may run again
  const lastDetectorModeRef = useRef('NONE')
  const modeSettleUntilRef = useRef(0)

  // --- Main per-frame effect ------------------------------------------------

  useEffect(() => {
    // If no hand is detected, reset everything
    if (!landmarks || landmarks.length < 21) {
      historyRef.current.palmDrag.active = false  // Cancel any in-progress swipe
      historyRef.current.palmDrag.stableFrames = 0
      pinchZoomStateRef.current = null             // Reset zoom tracking
      zoomOutBlockedUntilRef.current = 0
      infoToggleArmedRef.current = true
      infoTogglePrevStableRef.current = false
      lastDetectorModeRef.current = 'NONE'
      modeSettleUntilRef.current = 0
      setIsOpenPalm(false)                         // Clear open-palm flag
      setGesture(null)                             // Clear any active gesture
      return
    }

    const now = Date.now()
    // Must match GestureDemo’s smoothed `getDetectorMode` (see createDetectorModeSmoother)
    const mode = detectorModeRef?.current ?? 'NONE'

    if (mode !== lastDetectorModeRef.current) {
      const prevMode = lastDetectorModeRef.current
      lastDetectorModeRef.current = mode
      if (prevMode === 'ZOOM' && mode !== 'ZOOM') {
        zoomOutBlockedUntilRef.current = 0
      }
      modeSettleUntilRef.current = now + MODE_SETTLE_MS
      pinchZoomStateRef.current = null
      historyRef.current.palmDrag.active = false
      historyRef.current.palmDrag.missedFrames = 0
      historyRef.current.palmDrag.stableFrames = 0
      historyRef.current.counts.INFO_TOGGLE = 0
      historyRef.current.counts.OPEN_PALM = 0
      infoTogglePrevStableRef.current = false
    }

    const commandsAllowed = now >= modeSettleUntilRef.current

    if (commandsAllowed && mode === 'NULL') {
      infoToggleArmedRef.current = true
    }

    // --- Cooldown helper: fire a gesture only if enough time has passed ------
    const fireGesture = (name, cooldownMs, useGlobalDelay = true) => {
      // Check global cooldown (skip for zoom steps which use their own fast cooldown)
      if (useGlobalDelay && now < globalNextAllowedRef.current) return false
      // Check per-gesture cooldown
      if (now < cooldownRef.current[name]) return false
      // Set the per-gesture cooldown
      cooldownRef.current[name] = now + cooldownMs
      // Set the global cooldown (only for non-zoom gestures)
      if (useGlobalDelay) {
        globalNextAllowedRef.current = now + globalDelayRef.current
      }
      // Emit the gesture
      setGesture(name)
      return true
    }

    // --- Frame-count helper: require N consecutive frames of a pose ---------
    const requireFrames = (name, condition) => {
      const counts = historyRef.current.counts
      // Increment if condition is true, reset to 0 if false
      counts[name] = condition ? counts[name] + 1 : 0
      // Return true only when we've seen enough consecutive frames
      return counts[name] >= MIN_GESTURE_FRAMES
    }

    // Same logic but with a different threshold for open palm
    const requireOpenPalmFrames = (condition) => {
      const counts = historyRef.current.counts
      counts.OPEN_PALM = condition ? counts.OPEN_PALM + 1 : 0
      return counts.OPEN_PALM >= OPEN_PALM_MIN_FRAMES
    }

    // ========================================================================
    // STEP 1: Finger metrics + thumb–index distance (zoom delta)
    // ========================================================================

    // Distance between thumb tip and index tip (used for zoom delta tracking)
    const thumbIndexDist = distance(landmarks[4], landmarks[8])

    // --- Dev-only console log for live debugging ----------------------------
    if (import.meta.env.DEV) {
      console.log({ mode, thumbIndexDist })
    }

    // ========================================================================
    // STEP 3: Handle DRAG mode (green line)
    // ========================================================================

    if (mode === 'DRAG') {
      // Cancel any open-palm swipe tracking
      historyRef.current.palmDrag.active = false
      historyRef.current.palmDrag.missedFrames = 0
      // Reset zoom tracking since we're not in ZOOM
      pinchZoomStateRef.current = null
      // Clear palm state
      setIsOpenPalm(false)
      // DRAG doesn't fire a gesture event — ModelStage reads detectorMode directly
      setGesture(null)
      return
    }

    // ========================================================================
    // STEP 4: Handle ZOOM mode (blue line)
    // ========================================================================

    if (mode === 'ZOOM') {
      // Cancel any open-palm swipe tracking
      historyRef.current.palmDrag.active = false
      historyRef.current.palmDrag.missedFrames = 0
      // Clear palm state
      setIsOpenPalm(false)
      // Don't fall through to palm/swipe logic below
    } else {
      // Not in ZOOM mode → reset pinch smoothing / accumulator
      pinchZoomStateRef.current = null
    }

    // ========================================================================
    // STEP 5: Handle IDLE / FIST (white line)
    // ========================================================================

    // If the hand is a fist for enough consecutive frames → idle
    if (requireFrames('FIST', isNullFistPose(landmarks))) {
      historyRef.current.palmDrag.active = false  // Cancel swipe
      pinchZoomStateRef.current = null              // Reset zoom
      setIsOpenPalm(false)
      setGesture(null)                             // No gesture
      return
    }

    // ========================================================================
    // STEP 6: INFO TOGGLE — edge only (stable peace entered), not on cooldown while held
    // ========================================================================

    if (isInfoTogglePose(landmarks)) {
      historyRef.current.palmDrag.active = false
    }
    if (commandsAllowed) {
      const infoPoseStable = requireFrames('INFO_TOGGLE', isInfoTogglePose(landmarks))
      const infoEdge = infoPoseStable && !infoTogglePrevStableRef.current
      infoTogglePrevStableRef.current = infoPoseStable

      if (infoEdge) {
        const panelOpen = infoPanelOpenRef?.current ?? false
        if (panelOpen) {
          if (fireGesture('INFO_TOGGLE', INFO_TOGGLE_COOLDOWN_MS, false)) {
            return
          }
        } else if (infoToggleArmedRef.current) {
          if (fireGesture('INFO_TOGGLE', INFO_TOGGLE_COOLDOWN_MS, false)) {
            infoToggleArmedRef.current = false
            return
          }
        }
      }
    } else {
      historyRef.current.counts.INFO_TOGGLE = 0
      infoTogglePrevStableRef.current = false
    }

    // ========================================================================
    // STEP 7: Zoom in/out — smoothed pinch + accumulated spread (less jitter)
    // ========================================================================

    if (mode === 'ZOOM' && commandsAllowed) {
      const raw = thumbIndexDist
      const st = pinchZoomStateRef.current
      const smoothed = st ? st.smoothed + (raw - st.smoothed) * PINCH_DISTANCE_SMOOTH : raw
      let delta = st ? smoothed - st.smoothed : 0
      // Same smoothing for both directions; after zoom-in, ignore pinch-in briefly (close fist safely)
      if (delta < 0 && now < zoomOutBlockedUntilRef.current) {
        delta = 0
      }
      let accum = st?.accum ?? 0
      if (Math.abs(delta) < PINCH_ZOOM_DEADBAND) {
        delta = 0
        accum *= ZOOM_ACCUM_DRIFT_DECAY
      }
      accum += delta
      if (now < zoomOutBlockedUntilRef.current && accum < 0) {
        accum = 0
      }
      accum = Math.max(-ZOOM_ACCUM_CLAMP, Math.min(ZOOM_ACCUM_CLAMP, accum))

      if (accum >= ZOOM_ACCUM_STEP) {
        if (fireGesture('ZOOM_IN', ZOOM_STEP_COOLDOWN_IN_MS, false)) {
          zoomOutBlockedUntilRef.current = now + ZOOM_POST_IN_BLOCK_OUT_MS
          pinchZoomStateRef.current = { smoothed: raw, accum: 0 }
          return
        }
      } else if (accum <= -ZOOM_ACCUM_STEP) {
        if (fireGesture('ZOOM_OUT', ZOOM_STEP_COOLDOWN_OUT_MS, false)) {
          zoomOutBlockedUntilRef.current = 0
          pinchZoomStateRef.current = { smoothed: raw, accum: 0 }
          return
        }
      }

      pinchZoomStateRef.current = { smoothed, accum }
    } else if (mode === 'ZOOM' && !commandsAllowed) {
      pinchZoomStateRef.current = null
    }

    // ========================================================================
    // STEP 8: Handle SWITCH mode — open palm swipe (yellow line) — DO NOT CHANGE
    // ========================================================================

    // Check each finger with y-coordinate comparison (tip above base = extended)
    const fingerExtended = [
      landmarks[4].y < landmarks[2].y,   // thumb
      landmarks[8].y < landmarks[5].y,   // index
      landmarks[12].y < landmarks[9].y,  // middle
      landmarks[16].y < landmarks[13].y, // ring
      landmarks[20].y < landmarks[17].y, // pinky
    ]
    // Strict: all 5 extended. Loose: at least 4 extended
    const openPalmStrict =
      fingerExtended[0] && fingerExtended[1] && fingerExtended[2] && fingerExtended[3] && fingerExtended[4]
    const openPalmLoose = fingerExtended.filter(Boolean).length >= 4
    const openPalm = openPalmStrict || openPalmLoose
    // Update the open-palm state for the HUD
    setIsOpenPalm(openPalm)

    // Compute the horizontal center of the palm for swipe tracking
    const palmCenterX =
      (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5

    const palmDrag = historyRef.current.palmDrag

    if (requireOpenPalmFrames(openPalm)) {
      // Start or continue tracking a palm swipe
      if (!palmDrag.active) {
        // First frame of open palm → record starting position
        palmDrag.active = true
        palmDrag.startX = palmCenterX
        palmDrag.lastX = palmCenterX
        palmDrag.missedFrames = 0
        palmDrag.stableFrames = 1
      } else {
        // Continuing open palm → update last position
        palmDrag.lastX = palmCenterX
        palmDrag.missedFrames = 0
        palmDrag.stableFrames += 1
      }

      // Check if the palm has swiped far enough
      const deltaX = palmDrag.lastX - palmDrag.startX

      // Left-to-right swipe: started in left zone, ended in right zone
      const swipedRight =
        palmDrag.startX <= LEFT_ZONE_MAX &&
        palmDrag.lastX >= RIGHT_ZONE_MIN &&
        deltaX > SWIPE_THRESHOLD

      // Right-to-left swipe: started in right zone, ended in left zone
      const swipedLeft =
        palmDrag.startX >= RIGHT_ZONE_MIN &&
        palmDrag.lastX <= LEFT_ZONE_MAX &&
        deltaX < -SWIPE_THRESHOLD

      const navOk =
        commandsAllowed && palmDrag.stableFrames >= OPEN_PALM_STABLE_BEFORE_NAV_FRAMES

      // Fire navigation gestures (delayed until palm + mode have settled)
      if (navOk && swipedRight && fireGesture('NAV_NEXT', NAV_SWIPE_COOLDOWN_MS)) {
        palmDrag.active = false // Reset swipe tracker
        palmDrag.stableFrames = 0
        return
      }
      if (navOk && swipedLeft && fireGesture('NAV_PREV', NAV_SWIPE_COOLDOWN_MS)) {
        palmDrag.active = false // Reset swipe tracker
        palmDrag.stableFrames = 0
        return
      }
    } else {
      // Open palm lost — allow a few grace frames before cancelling
      if (palmDrag.active) {
        palmDrag.missedFrames += 1
        if (palmDrag.missedFrames > OPEN_PALM_GRACE_FRAMES) {
          palmDrag.active = false    // Too many missed frames, cancel swipe
          palmDrag.missedFrames = 0
          palmDrag.stableFrames = 0
        }
      }
    }

    // ========================================================================
    // STEP 9: No gesture matched this frame
    // ========================================================================
    setGesture(null)
  }, [landmarks, detectorModeRef, infoPanelOpenRef])

  // Return the current gesture and open-palm state to the parent component
  return { gesture, isOpenPalm }
}
