// js/handTracker.js
// MediaPipe Hand Landmarker wrapper with gesture detection and smoothing

const MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

/* ── Lerp helper ──────────────────────────────────────────── */
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpVec(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/* ── Gesture names ────────────────────────────────────────── */
export const GESTURE = {
  NONE:     'NONE',
  ONE:      'ONE',      // 1 finger — text
  TWO:      'TWO',      // 2 fingers — saturn
  THREE:    'THREE',    // 3 fingers — cube
  LOVE:     'LOVE',     // love sign — heart
  FIVE:     'FIVE',     // open hand — scatter
};

/* ── Finger tip / pip landmark indices ───────────────────── */
const TIPS = [4, 8, 12, 16, 20];   // thumb, index, middle, ring, pinky
const PIPS = [3, 6, 10, 14, 18];   // second joints

/* ── HandTracker class ───────────────────────────────────── */
export class HandTracker {
  constructor() {
    this.handLandmarker = null;
    this.running = false;
    this.lastResult = null;
    this.onResult = null; // callback(data)

    // Smoothed hand data
    this._smooth = {
      pos:     { x: 0, y: 0, z: 0 },
      wrist:   { x: 0, y: 0, z: 0 },
      tips:    Array.from({ length: 5 }, () => ({ x: 0, y: 0, z: 0 })),
      gesture: GESTURE.NONE,
      gestureConfidence: 0,
    };

    this._gestureHistory = [];
    this._gestureLockFrames = 0;
    this._lastGesture = GESTURE.NONE;
    this._prevGesture = GESTURE.NONE;
    this._gestureStableCount = 0;
    this._STABLE_THRESHOLD = 6; // frames needed to commit gesture change

    // Throttle detection to ~30 fps
    this._lastDetectTime = 0;
    this._detectInterval = 33; // ms
  }

  async init(videoEl, statusCallback) {
    try {
      statusCallback('Loading MediaPipe…');

      // Dynamically import vision tasks
      const { HandLandmarker, FilesetResolver } =
        await import(`${VISION_CDN}/vision_bundle.mjs`);

      statusCallback('Creating hand landmarker…');

      const vision = await FilesetResolver.forVisionTasks(MP_CDN);

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${VISION_CDN}/hand_landmarker.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      this.videoEl = videoEl;
      this.running = true;
      statusCallback('Hand tracker ready');
      return true;
    } catch (err) {
      console.error('[HandTracker] Init failed:', err);
      statusCallback('Hand tracker error: ' + err.message);
      return false;
    }
  }

  detect(timestamp) {
    if (!this.running || !this.handLandmarker || !this.videoEl) return null;
    if (this.videoEl.readyState < 2) return null;

    const now = performance.now();
    if (now - this._lastDetectTime < this._detectInterval) return this._smooth;
    this._lastDetectTime = now;

    let results;
    try {
      results = this.handLandmarker.detectForVideo(this.videoEl, timestamp);
    } catch (e) {
      return this._smooth;
    }

    if (!results || !results.landmarks || results.landmarks.length === 0) {
      // No hand — keep last smooth but fade gesture
      this._gestureStableCount = 0;
      this._smooth.gesture = GESTURE.NONE;
      return this._smooth;
    }

    const lm = results.landmarks[0];
    const wl = results.worldLandmarks ? results.worldLandmarks[0] : null;

    // Smooth wrist position (landmark 0)
    const wrist = lm[0];
    const alpha = 0.25; // smoothing factor
    this._smooth.wrist = lerpVec(this._smooth.wrist, wrist, alpha);

    // Hand center (average of wrist + palm landmarks)
    const palmIdx = [0, 1, 5, 9, 13, 17];
    let cx = 0, cy = 0, cz = 0;
    for (const i of palmIdx) { cx += lm[i].x; cy += lm[i].y; cz += lm[i].z; }
    cx /= palmIdx.length; cy /= palmIdx.length; cz /= palmIdx.length;
    this._smooth.pos = lerpVec(this._smooth.pos, { x: cx, y: cy, z: cz }, alpha);

    // Smooth fingertip positions
    for (let f = 0; f < 5; f++) {
      const tip = lm[TIPS[f]];
      this._smooth.tips[f] = lerpVec(this._smooth.tips[f], tip, alpha);
    }

    // Detect gesture
    const rawGesture = this._detectGesture(lm);

    // Stabilize gesture with temporal filter
    if (rawGesture === this._lastGesture) {
      this._gestureStableCount++;
    } else {
      this._gestureStableCount = 1;
      this._lastGesture = rawGesture;
    }

    if (this._gestureStableCount >= this._STABLE_THRESHOLD) {
      this._smooth.gesture = rawGesture;
    }

    return this._smooth;
  }

  _detectGesture(lm) {
    // Count extended fingers
    const extended = this._getExtendedFingers(lm);
    const count = extended.reduce((s, v) => s + v, 0);

    // Love sign: thumb + pinky extended, middle + ring closed
    // Index finger curled (touching ring finger base area)
    const isLove = this._isLoveSign(lm, extended);
    if (isLove) return GESTURE.LOVE;

    if (count === 1 && extended[1]) return GESTURE.ONE;
    if (count === 2 && extended[1] && extended[2]) return GESTURE.TWO;
    if (count === 3 && extended[1] && extended[2] && extended[3]) return GESTURE.THREE;
    if (count >= 5) return GESTURE.FIVE;

    return GESTURE.NONE;
  }

  _getExtendedFingers(lm) {
    // Returns [thumb, index, middle, ring, pinky] booleans
    const extended = [false, false, false, false, false];

    // Thumb: compare tip X vs IP joint X (mirrored)
    const thumbTip = lm[4];
    const thumbIp  = lm[3];
    const wrist    = lm[0];
    const indexMcp = lm[5];

    // Determine hand orientation
    const isRightHand = wrist.x < indexMcp.x;
    extended[0] = isRightHand
      ? thumbTip.x > thumbIp.x + 0.02
      : thumbTip.x < thumbIp.x - 0.02;

    // Fingers: tip Y vs pip Y (lower Y = higher on screen = extended)
    for (let f = 1; f < 5; f++) {
      const tip = lm[TIPS[f]];
      const pip = lm[PIPS[f]];
      const mcp = lm[PIPS[f] - 2];
      // Extended if tip is above pip and pip is above mcp
      const tipAbovePip = tip.y < pip.y - 0.04;
      const pipAboveMcp = pip.y < mcp.y + 0.02;
      extended[f] = tipAbovePip && pipAboveMcp;
    }
    return extended;
  }

  _isLoveSign(lm, extended) {
    // Love sign: thumb out, index curled/semi-curled, middle down, ring down, pinky up
    // Key heuristic: thumb extended, pinky extended, index & middle & ring NOT extended
    const [thumb, index, middle, ring, pinky] = extended;
    if (!thumb || !pinky) return false;
    if (middle || ring)   return false;
    // Index should be partially curled — tip below MCP level
    const indexTip = lm[8];
    const indexMcp = lm[5];
    const indexCurled = indexTip.y > indexMcp.y + 0.02;
    return indexCurled;
  }

  stop() {
    this.running = false;
    if (this.handLandmarker) {
      try { this.handLandmarker.close(); } catch (_) {}
    }
  }
}