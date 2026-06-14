// js/main.js
// Main application orchestrator

import * as THREE from 'three';
import { CosmicBackground } from './cosmicBackground.js';
import { ParticleSystem }   from './particleSystem.js';
import { HandTracker, GESTURE } from './handTracker.js';

/* ── DOM references ─────────────────────────────────────── */
const videoEl    = document.getElementById('webcam');
const canvasEl   = document.getElementById('three-canvas');
const loadOver   = document.getElementById('loading-overlay');
const loadText   = document.getElementById('loading-text');
const denyOver   = document.getElementById('deny-overlay');
const camDot     = document.getElementById('cam-dot');
const camLabel   = document.getElementById('cam-label');
const trackDot   = document.getElementById('track-dot');
const trackLabel = document.getElementById('track-label');
const gestDot    = document.getElementById('gesture-dot');
const gestLabel  = document.getElementById('gesture-label');

/* ── Gesture display names ──────────────────────────────── */
const GESTURE_NAMES = {
  [GESTURE.NONE]:  '—',
  [GESTURE.ONE]:   '☝️ "By Arif"',
  [GESTURE.TWO]:   '✌️ Saturn',
  [GESTURE.THREE]: '🤟 Cube',
  [GESTURE.LOVE]:  '🫰 Heart',
  [GESTURE.FIVE]:  '🤚 Scatter',
};

/* ── Three.js Setup ─────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({
  canvas: canvasEl,
  antialias: false,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x020408, 1);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 12);

/* ── Resize handler ─────────────────────────────────────── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ── Build scene ────────────────────────────────────────── */
const bg      = new CosmicBackground(scene);
const particles = new ParticleSystem(scene);

/* ── Hand tracker ───────────────────────────────────────── */
const tracker = new HandTracker();

/* ── Hand → world space conversion ─────────────────────── */
// MediaPipe gives normalized [0..1] coordinates
// We map to world space based on camera frustum at z=0
const WORLD_W = 14; // horizontal world span
const WORLD_H =  8; // vertical world span

// Lerp helper (no allocation)
function lerp(a, b, t) { return a + (b - a) * t; }

// Smooth hand world position (persistent objects to avoid GC)
const _smoothHandWorld = new THREE.Vector3(0, 0, 0);
const _targetHandWorld = new THREE.Vector3(0, 0, 0);
const _handRotMat      = new THREE.Matrix4();
const _euler           = new THREE.Euler();
const _quat            = new THREE.Quaternion();

let _prevGesture = GESTURE.NONE;
let _handVisible = false;
let _handLostFrames = 0;
const HAND_LOST_THRESHOLD = 12;

/* ── Main animation loop ────────────────────────────────── */
let _startTime = null;
let _prevTime  = null;
let _frameCount = 0;

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (_startTime === null) _startTime = timestamp;
  const time  = (timestamp - _startTime) * 0.001;
  const delta = _prevTime !== null ? (timestamp - _prevTime) * 0.001 : 0.016;
  _prevTime = timestamp;

  // ── Hand tracking ──────────────────────────────────────
  const hand = tracker.detect(timestamp);

  if (hand && hand.gesture !== GESTURE.NONE) {
    _handLostFrames = 0;
    _handVisible = true;

    // Map hand center from normalized [0..1] to world space
    // Flip X because webcam is mirrored
    const nx = 1.0 - hand.pos.x;
    const ny = hand.pos.y;

    // Depth estimation from wrist Z (roughly -0.1 to 0.1 range)
    const depthZ = hand.pos.z;
    const depth  = Math.max(0.3, Math.min(2.2, 1.0 - depthZ * 8));

    _targetHandWorld.set(
      (nx - 0.5) * WORLD_W,
      -(ny - 0.5) * WORLD_H,
      0
    );

    // Smooth world position
    const posAlpha = 0.18;
    _smoothHandWorld.x = lerp(_smoothHandWorld.x, _targetHandWorld.x, posAlpha);
    _smoothHandWorld.y = lerp(_smoothHandWorld.y, _targetHandWorld.y, posAlpha);
    _smoothHandWorld.z = lerp(_smoothHandWorld.z, _targetHandWorld.z, posAlpha);

    particles.handPos.copy(_smoothHandWorld);
    particles.handScale = lerp(particles.handScale, depth, 0.12);

    // Compute hand rotation from wrist + index MCP direction
    const wrist    = hand.wrist;
    const tips     = hand.tips;
    if (tips && tips[0] && tips[1]) {
      // Approximate rotation: use wrist-to-indexTip as "up" reference
      const dx = (1 - tips[1].x) - (1 - wrist.x);
      const dy = -(tips[1].y - wrist.y);
      const angle = Math.atan2(dx, dy);
      _euler.set(0, 0, angle);
      _quat.setFromEuler(_euler);
      _handRotMat.makeRotationFromQuaternion(_quat);
      // Smooth rotation
      const curRot = new THREE.Euler().setFromRotationMatrix(particles.handRot);
      curRot.z = lerp(curRot.z, angle, 0.15);
      particles.handRot.makeRotationZ(curRot.z);
    }

    // Gesture change
    if (hand.gesture !== _prevGesture) {
      _prevGesture = hand.gesture;
      particles.setGesture(hand.gesture);
      gestLabel.textContent = 'Gesture: ' + (GESTURE_NAMES[hand.gesture] || '—');
    }

    trackDot.className   = 'dot active';
    trackLabel.textContent = 'Hand: Detected';

  } else {
    _handLostFrames++;
    if (_handLostFrames > HAND_LOST_THRESHOLD) {
      if (_handVisible) {
        _handVisible = false;
        // Only switch to NONE if we're not already scattered
        if (_prevGesture !== GESTURE.NONE) {
          _prevGesture = GESTURE.NONE;
          particles.setGesture(GESTURE.NONE);
          gestLabel.textContent = 'Gesture: —';
        }
      }
      trackDot.className   = 'dot';
      trackLabel.textContent = 'Hand: Waiting…';
    }
  }

  // ── Update systems ──────────────────────────────────────
  bg.update(time);
  particles.update(time, delta);

  // ── Render ─────────────────────────────────────────────
  renderer.render(scene, camera);
}

/* ── Camera setup ───────────────────────────────────────── */
async function setupCamera() {
  setLoading('Requesting camera access…');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width:       { ideal: 640 },
        height:      { ideal: 480 },
        facingMode:  'user',
        frameRate:   { ideal: 30 },
      },
      audio: false,
    });

    videoEl.srcObject = stream;

    await new Promise((resolve, reject) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play().then(resolve).catch(reject);
      };
      videoEl.onerror = reject;
    });

    camDot.className   = 'dot active';
    camLabel.textContent = 'Camera: Active';
    return true;

  } catch (err) {
    console.error('[Camera]', err);
    camDot.className   = 'dot error';
    camLabel.textContent = 'Camera: Denied';
    denyOver.classList.remove('hidden');
    return false;
  }
}

/* ── Loading helpers ────────────────────────────────────── */
function setLoading(msg) {
  loadText.textContent = msg;
}
function hideLoading() {
  loadOver.classList.add('fade-out');
  setTimeout(() => { loadOver.style.display = 'none'; }, 900);
}

/* ── Boot sequence ──────────────────────────────────────── */
async function boot() {
  // Start Three.js render loop immediately (shows background while loading)
  requestAnimationFrame(animate);

  const camOk = await setupCamera();
  if (!camOk) return;

  setLoading('Loading AI hand tracker…');
  const trackerOk = await tracker.init(videoEl, msg => setLoading(msg));
  if (!trackerOk) {
    trackDot.className    = 'dot error';
    trackLabel.textContent  = 'Tracker: Failed';
  }

  hideLoading();
}

boot();