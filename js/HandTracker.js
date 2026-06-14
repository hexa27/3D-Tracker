// ============================================
// HAND TRACKER
// Wrapper MediaPipe HandLandmarker dengan
// smoothing, gesture detection, & throttling.
// ============================================

export class HandTracker {
  constructor() {
    this.isReady    = false;
    this.landmarker = null;

    // State tangan yang sudah dihaluskan
    this.smoothed = {
      fingerCount : 0,
      gesture     : 'none',   // 'none' | 'text' | 'saturn' | 'cube' | 'heart' | 'scatter'
      handX       : 0,         // -1..1 (normalized, mirrored)
      handY       : 0,         // -1..1
      rotation    : 0,         // rad, rotasi tangan
      velocity    : { x: 0, y: 0 }
    };

    // Buffer untuk exponential smoothing
    this._raw = { ...this.smoothed };

    // Throttle: proses inferensi maks 30x/detik
    this._lastInferenceTime = 0;
    this._inferenceInterval = 1000 / 30; // ms

    // Riwayat posisi untuk hitung velocity
    this._posHistory = [];
    this._maxHistory = 6;

    // Callback dipanggil saat gesture berubah
    this.onGestureChange = null;
  }

  // ─── Init MediaPipe ───────────────────────
  async init() {
    // Import MediaPipe dari CDN (ESM)
    const { HandLandmarker, FilesetResolver } =
      await import('[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs)');

    const vision = await FilesetResolver.forVisionTasks(
      '[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm)'
    );

    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          '[storage.googleapis.com](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)',
        delegate: 'GPU'          // GPU delegate untuk performa
      },
      runningMode          : 'VIDEO',
      numHands             : 1,  // 1 tangan sudah cukup
      minHandDetectionConfidence : 0.6,
      minHandPresenceConfidence  : 0.5,
      minTrackingConfidence      : 0.5
    });

    this.isReady = true;
    console.log('[HandTracker] MediaPipe HandLandmarker ready');
  }

  // ─── Process frame video ──────────────────
  /**
   * Dipanggil setiap frame dari render loop.
   * Throttled agar tidak membebani CPU.
   * @param {HTMLVideoElement} video
   */
  processFrame(video) {
    if (!this.isReady || !video || video.readyState < 2) return;

    const now = performance.now();
    if (now - this._lastInferenceTime < this._inferenceInterval) return;
    this._lastInferenceTime = now;

    try {
      // Inferensi synchronous (VIDEO mode pakai timestamp)
      const result = this.landmarker.detectForVideo(video, now);
      this._processResult(result, now);
    } catch (e) {
      // Silent fail — jangan crash render loop
    }
  }

  // ─── Parse hasil deteksi ──────────────────
  _processResult(result, timestamp) {
    if (!result.landmarks || result.landmarks.length === 0) {
      // Tidak ada tangan — decay smoothly ke 'none'
      this._decayToNone();
      return;
    }

    const lm = result.landmarks[0]; // 21 landmark tangan pertama

    // ── Hitung posisi tangan (wrist = lm[0])
    // MediaPipe: x & y dalam 0..1, mirror-kan x karena video di-mirror
    const rawX = 1.0 - lm[0].x; // mirror
    const rawY = lm[0].y;

    // Konversi ke -1..1
    const normX = (rawX - 0.5) * 2;
    const normY = -(rawY - 0.5) * 2; // y dibalik (atas = positif)

    // ── Hitung rotasi tangan (vektor wrist→middle finger base)
    const wrist  = lm[0];
    const midMCP = lm[9];
    const rawRot = Math.atan2(
      (midMCP.y - wrist.y),
      (midMCP.x - wrist.x)
    );
    // Offset -PI/2 agar rotasi 0 = tangan tegak
    const rotation = rawRot + Math.PI / 2;

    // ── Hitung finger count
    const fingerCount = this._countFingers(lm);

    // ── Detect gesture
    const gesture = this._detectGesture(lm, fingerCount);

    // ── Exponential smoothing (alpha = 0.18 → sangat halus)
    const alpha = 0.18;
    this._raw.handX     = this._lerp(this._raw.handX,     normX,       alpha);
    this._raw.handY     = this._lerp(this._raw.handY,     normY,       alpha);
    this._raw.rotation  = this._lerpAngle(this._raw.rotation, rotation, alpha);

    // Finger count & gesture tidak di-smooth (diskrit)
    const prevGesture = this.smoothed.gesture;
    this.smoothed.fingerCount = fingerCount;
    this.smoothed.gesture     = gesture;
    this.smoothed.handX       = this._raw.handX;
    this.smoothed.handY       = this._raw.handY;
    this.smoothed.rotation    = this._raw.rotation;

    // ── Velocity dari riwayat posisi
    this._posHistory.push({ x: normX, y: normY, t: timestamp });
    if (this._posHistory.length > this._maxHistory)
      this._posHistory.shift();

    if (this._posHistory.length >= 2) {
      const oldest = this._posHistory[0];
      const newest = this._posHistory[this._posHistory.length - 1];
      const dt = (newest.t - oldest.t) / 1000;
      if (dt > 0) {
        this.smoothed.velocity.x = (newest.x - oldest.x) / dt;
        this.smoothed.velocity.y = (newest.y - oldest.y) / dt;
      }
    }

    // Panggil callback jika gesture berubah
    if (gesture !== prevGesture && this.onGestureChange) {
      this.onGestureChange(gesture, this.smoothed);
    }
  }

  // ─── Count raised fingers ─────────────────
  _countFingers(lm) {
    // Tip index & MCP index untuk 5 jari
    const tips = [4, 8, 12, 16, 20];
    const mcps = [2, 5, 9, 13, 17];
    let count  = 0;

    // Ibu jari: bandingkan x (karena arah berbeda)
    const thumbTip = lm[4];
    const thumbIP  = lm[3];
    const wristX   = lm[0].x;
    const thumbRaised = Math.abs(thumbTip.x - wristX) > Math.abs(thumbIP.x - wristX) + 0.02;
    if (thumbRaised) count++;

    // 4 jari lain: tip lebih tinggi dari MCP (y lebih kecil = lebih atas)
    for (let i = 1; i < 5; i++) {
      if (lm[tips[i]].y < lm[mcps[i]].y - 0.04) count++;
    }

    return count;
  }

  // ─── Detect specific gestures ─────────────
  _detectGesture(lm, fingerCount) {
    // Love sign: ibu jari + kelingking naik, telunjuk & tengah & manis turun
    const thumbUp  = lm[4].y < lm[3].y - 0.03;
    const pinkyUp  = lm[20].y < lm[17].y - 0.04;
    const indexDwn = lm[8].y > lm[6].y + 0.02;
    const midDwn   = lm[12].y > lm[10].y + 0.02;
    const ringDwn  = lm[16].y > lm[14].y + 0.02;

    if (thumbUp && pinkyUp && indexDwn && midDwn && ringDwn) return 'heart';

    switch (fingerCount) {
      case 1: return 'text';
      case 2: return 'saturn';
      case 3: return 'cube';
      case 5: return 'scatter';
      default: return 'none';
    }
  }

  // ─── Decay ke none saat tangan hilang ────
  _decayToNone() {
    const prevGesture = this.smoothed.gesture;
    this.smoothed.gesture     = 'none';
    this.smoothed.fingerCount = 0;
    this._posHistory = [];
    this.smoothed.velocity = { x: 0, y: 0 };
    if (prevGesture !== 'none' && this.onGestureChange) {
      this.onGestureChange('none', this.smoothed);
    }
  }

  // ─── Math utils ──────────────────────────
  _lerp(a, b, t)      { return a + (b - a) * t; }
  _lerpAngle(a, b, t) {
    // Lerp sudut — hindari gimbal lock di ±PI
    let diff = b - a;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }
}
