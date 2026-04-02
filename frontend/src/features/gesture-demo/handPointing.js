// ============================================================================
// handPointing.js — Hand pose classification for the gesture demo.
//
// MediaPipe hand landmark indices used throughout:
//   0  = wrist
//   1  = thumb CMC (carpometacarpal)
//   2  = thumb MCP (metacarpophalangeal)
//   3  = thumb IP  (interphalangeal)
//   4  = thumb tip
//   5  = index MCP
//   8  = index tip
//   9  = middle MCP
//   12 = middle tip
//   13 = ring MCP
//   16 = ring tip
//   17 = pinky MCP
//   20 = pinky tip
//
// All distance checks use 2D euclidean distance on normalized x/y (0–1).
// ============================================================================

// --- Core distance helper ---------------------------------------------------

/** Euclidean distance between two landmarks using only x and y (no z). */
function distance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

// --- Thresholds (tune these if detection feels too loose or too strict) ------

/** Thumb tip must be farther than this from each of middle/ring/pinky tips to count as "open". */
const THUMB_OPEN_MIN_DIST = 0.08

/** Finger tip must be farther than this from its MCP base to count as "extended". */
const FINGER_EXTENDED_MIN_DIST = 0.08

/** Finger tip must be at or below this distance from its MCP base to count as "curled/down". */
const FINGER_CURLED_MAX_DIST = 0.15

/** Index + middle tips must be closer than this to count as the info-toggle "peace sign". */
const INFO_TOGGLE_TIP_PROXIMITY = 0.055

/** At least this many fingers must look extended (y-check) to count as open palm. */
const OPEN_PALM_MIN_FINGERS = 4

/**
 * Fist / NULL idle: each non-thumb fingertip must be at least this far below its PIP
 * on screen (y increases downward). Stops a slight bend from counting as a full fist.
 */
const NULL_FIST_MIN_TIP_BELOW_PIP = 0.016

// --- Pinch thresholds (used by useGestureDetector for zoom in/out) ----------

/** Thumb–index distance below this = pinch closed. */
export const PINCH_CLOSED_THRESHOLD = 0.065

/** Thumb–index distance above this = pinch open. */
export const PINCH_OPEN_THRESHOLD = 0.1

/** Generic "two finger tips close" threshold. */
export const TWO_FINGER_CLOSE = 0.03

// --- Finger state helpers ---------------------------------------------------

/**
 * THUMB OPEN: thumb tip (4) is far from middle (12), ring (16), and pinky (20) tips.
 * Index (8) is intentionally excluded — thumb near index is a pinch, not "thumb closed".
 * When all three distances exceed THUMB_OPEN_MIN_DIST, thumb is sticking outward = open.
 */
function isThumbOpen(landmarks) {
  // Distance from thumb tip to middle finger tip
  const thumbToMiddle = distance(landmarks[4], landmarks[12])
  // Distance from thumb tip to ring finger tip
  const thumbToRing = distance(landmarks[4], landmarks[16])
  // Distance from thumb tip to pinky finger tip
  const thumbToPinky = distance(landmarks[4], landmarks[20])
  // Thumb is open only when ALL three distances are large (thumb sticking outward)
  return (
    thumbToMiddle > THUMB_OPEN_MIN_DIST &&
    thumbToRing > THUMB_OPEN_MIN_DIST &&
    thumbToPinky > THUMB_OPEN_MIN_DIST
  )
}

/**
 * INDEX EXTENDED: index tip (8) is far from its MCP base (5).
 * Direction-agnostic — works whether the finger points up, sideways, or diagonally.
 */
function isIndexExtended(landmarks) {
  return distance(landmarks[8], landmarks[5]) > FINGER_EXTENDED_MIN_DIST
}

/**
 * MIDDLE FINGER CURLED: middle tip (12) is close to its MCP base (9).
 */
function isMiddleCurled(landmarks) {
  return distance(landmarks[12], landmarks[9]) <= FINGER_CURLED_MAX_DIST
}

/**
 * RING FINGER CURLED: ring tip (16) is close to its MCP base (13).
 */
function isRingCurled(landmarks) {
  return distance(landmarks[16], landmarks[13]) <= FINGER_CURLED_MAX_DIST
}

/**
 * PINKY FINGER CURLED: pinky tip (20) is close to its MCP base (17).
 */
function isPinkyCurled(landmarks) {
  return distance(landmarks[20], landmarks[17]) <= FINGER_CURLED_MAX_DIST
}

/**
 * MIDDLE EXTENDED: middle tip (12) is far from its MCP base (9).
 */
function isMiddleExtended(landmarks) {
  return distance(landmarks[12], landmarks[9]) > FINGER_EXTENDED_MIN_DIST
}

// --- Pose classifiers -------------------------------------------------------

/**
 * ZOOM MODE (BLUE): thumb open/extended + index open/extended + middle/ring/pinky curled.
 * Both the thumb and index are sticking out (L-shape / gun hand).
 * Returns false if the hand is an open palm or info-toggle pose.
 */
export function isZoomModePose(landmarks) {
  // Guard: need full 21-landmark hand
  if (!landmarks || landmarks.length < 21) return false
  // Not zoom if all fingers are up (that's SWITCH mode)
  if (isOpenPalmLike(landmarks)) return false
  // Not zoom if index+middle are doing the info-toggle peace sign
  if (isInfoTogglePose(landmarks)) return false
  // Thumb must be open (far from middle/ring/pinky tips)
  if (!isThumbOpen(landmarks)) return false
  // Index finger must be extended (straight)
  if (!isIndexExtended(landmarks)) return false
  // The remaining three fingers must all be curled down
  if (!isMiddleCurled(landmarks)) return false
  if (!isRingCurled(landmarks)) return false
  if (!isPinkyCurled(landmarks)) return false
  // All conditions met → ZOOM mode
  return true
}

/**
 * DRAG MODE (GREEN): index extended + thumb NOT open + middle/ring/pinky curled.
 * Classic pointing-finger pose — only the index finger is up.
 * Returns false if the hand is open palm, info-toggle, or zoom.
 */
export function isIndexPointing(landmarks) {
  // Guard: need full 21-landmark hand
  if (!landmarks || landmarks.length < 21) return false
  // Not drag if all fingers are up (that's SWITCH mode)
  if (isOpenPalmLike(landmarks)) return false
  // Not drag if index+middle are doing the info-toggle peace sign
  if (isInfoTogglePose(landmarks)) return false
  // If thumb is open, this is ZOOM mode, not DRAG
  if (isThumbOpen(landmarks)) return false
  // Index finger must be extended (straight)
  if (!isIndexExtended(landmarks)) return false
  // The remaining three fingers must all be curled down
  if (!isMiddleCurled(landmarks)) return false
  if (!isRingCurled(landmarks)) return false
  if (!isPinkyCurled(landmarks)) return false
  // All conditions met → DRAG mode
  return true
}

/**
 * SWITCH MODE (YELLOW): open palm — most or all fingers extended upward.
 * Uses y-coordinate comparison (tip above its MCP) because palm direction matters here.
 * At least 4 of 5 fingers must look extended.
 * (DO NOT CHANGE — already working)
 */
export function isOpenPalmLike(landmarks) {
  // Guard: need full 21-landmark hand
  if (!landmarks || landmarks.length < 21) return false
  // Check each finger: tip.y < mcp.y means the tip is above the base (screen y is inverted)
  const fingerExtended = [
    landmarks[4].y < landmarks[2].y,   // thumb tip above thumb MCP
    landmarks[8].y < landmarks[5].y,   // index tip above index MCP
    landmarks[12].y < landmarks[9].y,  // middle tip above middle MCP
    landmarks[16].y < landmarks[13].y, // ring tip above ring MCP
    landmarks[20].y < landmarks[17].y, // pinky tip above pinky MCP
  ]
  // Count how many fingers are extended
  const extendedCount = fingerExtended.filter(Boolean).length
  // Open palm if at least 4 fingers are up
  return extendedCount >= OPEN_PALM_MIN_FINGERS
}

/**
 * INFO TOGGLE MODE (ORANGE): index + middle fingers both extended and close together,
 * ring and pinky curled. This is the "peace sign" or "V" gesture.
 * (DO NOT CHANGE — already working)
 */
export function isInfoTogglePose(landmarks) {
  // Guard: need full 21-landmark hand
  if (!landmarks || landmarks.length < 21) return false
  // Not info-toggle if it's an open palm
  if (isOpenPalmLike(landmarks)) return false
  // Index must be extended
  if (!isIndexExtended(landmarks)) return false
  // Middle must be extended
  if (!isMiddleExtended(landmarks)) return false
  // Index and middle tips must be close together (forming the "V")
  const indexMiddleDist = distance(landmarks[8], landmarks[12])
  if (indexMiddleDist >= INFO_TOGGLE_TIP_PROXIMITY) return false
  // Ring must be curled
  if (!isRingCurled(landmarks)) return false
  // Pinky must be curled
  if (!isPinkyCurled(landmarks)) return false
  // All conditions met → INFO TOGGLE mode
  return true
}

/**
 * IDLE / NULL MODE (WHITE): all four non-thumb fingers are clearly curled (fist).
 * Uses y-coordinate check with a margin so a shallow bend does not read as idle.
 */
export function isNullFistPose(landmarks) {
  // Guard: need full 21-landmark hand
  if (!landmarks || landmarks.length < 21) return false
  const m = NULL_FIST_MIN_TIP_BELOW_PIP
  // Each fingertip must sit clearly below its PIP (screen y, larger = lower on screen)
  return (
    landmarks[8].y > landmarks[6].y + m &&
    landmarks[12].y > landmarks[10].y + m &&
    landmarks[16].y > landmarks[14].y + m &&
    landmarks[20].y > landmarks[18].y + m
  )
}

// --- Main detector mode classifier -----------------------------------------

/**
 * Determines the current gesture detector mode from 21 hand landmarks.
 * Priority order:
 *   1. NONE    — no hand / insufficient landmarks
 *   2. NULL    — fist / idle (white)
 *   3. SWITCH  — open palm (yellow)
 *   4. INFO_TOGGLE — peace sign (orange)
 *   5. ZOOM    — thumb + index extended, rest curled (blue)
 *   6. DRAG    — only index extended, thumb closed (green)
 *   7. NULL    — fallback idle (white)
 */
export function getDetectorMode(landmarks) {
  // No hand data at all
  if (!landmarks || landmarks.length < 21) return 'NONE'
  // Fist — all fingers curled → idle
  if (isNullFistPose(landmarks)) return 'NULL'
  // Open palm — most fingers up → switch items
  if (isOpenPalmLike(landmarks)) return 'SWITCH'
  // Peace sign — index + middle up and close → toggle info
  if (isInfoTogglePose(landmarks)) return 'INFO_TOGGLE'
  // Thumb + index out, rest curled → zoom
  if (isZoomModePose(landmarks)) return 'ZOOM'
  // Only index out, thumb tucked → drag
  if (isIndexPointing(landmarks)) return 'DRAG'
  // Nothing matched → idle
  return 'NULL'
}

// --- Temporal smoothing (reduces HUD/canvas flicker between modes) -----------

/** Raw mode must match this many consecutive frames before the UI switches (default). */
export const DETECTOR_MODE_STABLE_FRAMES = 5

/**
 * Entering NULL/idle needs more consecutive frames than other modes so brief poses
 * do not snap the HUD to white.
 */
export const NULL_MODE_ENTER_STABLE_FRAMES = 12

/**
 * Creates a stateful smoother for `getDetectorMode` results.
 * A new mode only applies after the same raw mode is seen enough times in a row.
 * Optional `enterFramesByMode` overrides the count for specific modes (e.g. NULL).
 * Call `.reset()` when the hand is lost so the next session starts clean.
 */
export function createDetectorModeSmoother(
  requiredStableFrames = DETECTOR_MODE_STABLE_FRAMES,
  options = {},
) {
  const enterFramesByMode = options.enterFramesByMode ?? {}

  // Last mode we actually expose to the canvas/HUD/ModelStage
  let stableMode = 'NONE'
  // Candidate mode we are accumulating frames for
  let pendingMode = 'NONE'
  // How many consecutive frames `pendingMode` has matched
  let pendingCount = 0

  function framesNeededFor(mode) {
    return enterFramesByMode[mode] ?? requiredStableFrames
  }

  function smooth(rawMode) {
    // Already stable on this mode — reset pending tracking
    if (rawMode === stableMode) {
      pendingMode = rawMode
      pendingCount = 0
      return stableMode
    }
    // Same candidate as last frame — increment streak
    if (rawMode === pendingMode) {
      pendingCount += 1
      if (pendingCount >= framesNeededFor(pendingMode)) {
        stableMode = rawMode
        pendingCount = 0
      }
      return stableMode
    }
    // New candidate — start streak at 1
    pendingMode = rawMode
    pendingCount = 1
    return stableMode
  }

  smooth.reset = () => {
    stableMode = 'NONE'
    pendingMode = 'NONE'
    pendingCount = 0
  }

  return smooth
}

// --- Utility exports (used by ModelStage for finger-orbit) ------------------

/**
 * Returns mirrored normalized position of the index tip.
 * Used by ModelStage to map finger position to orbit rotation.
 */
export function indexTipMirroredNorm(landmarks) {
  const t = landmarks[8] // index finger tip
  return { nx: 1 - t.x, ny: t.y } // mirror x so moving hand right rotates model right
}

// --- Legacy exports (kept for backward compat, delegate to new names) -------

export function isThumbLineStraightOpen(landmarks) {
  if (!landmarks || landmarks.length < 21) return false
  return isThumbOpen(landmarks)
}

export function isThumbChainStraightOpen(landmarks) {
  return isThumbLineStraightOpen(landmarks)
}

export function isThumbOpenExtended(landmarks) {
  return isThumbLineStraightOpen(landmarks)
}

export function isThumbOpenLike(landmarks) {
  return isThumbOpenExtended(landmarks)
}

export function isThumbClearlyOpen(landmarks) {
  return isThumbOpenExtended(landmarks)
}

export function isIndexOpenExtended(landmarks) {
  if (!landmarks || landmarks.length < 21) return false
  return isIndexExtended(landmarks)
}

export function isIndexFingerExtended(landmarks) {
  return isIndexOpenExtended(landmarks)
}

export function getPinchClass(landmarks) {
  if (!landmarks || landmarks.length < 21) return 'MID'
  // Distance between thumb tip and index tip
  const pinchDistance = distance(landmarks[4], landmarks[8])
  // Classify as closed, open, or mid-range
  if (pinchDistance < PINCH_CLOSED_THRESHOLD) return 'CLOSED'
  if (pinchDistance > PINCH_OPEN_THRESHOLD) return 'OPEN'
  return 'MID'
}
