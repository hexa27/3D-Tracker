// ============================================
// MAIN — Entry point aplikasi
// Inisialisasi Three.js, HandTracker,
// ParticleSystem, dan render loop utama.
// ============================================

import { HandTracker }     from './HandTracker.js';
import { ParticleSystem }  from './ParticleSystem.js';
import { FormationBuilder } from './FormationBuilder.js';

// ────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────
const PARTICLE_COUNT = 2000;

// ────────────────────────────────────────────
// THREE.JS SETUP
// ────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const W = window.innerWidth;
const H = window.innerHeight;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000510);

// Camera perspektif
const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
camera.position.set(0, 0, 12);

// Renderer — antialias minimal untuk performa
const renderer = new THREE.WebGLRenderer({
  antialias      : false,
  powerPreference: 'high-performance',
  alpha          : false
});
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // clamp DPR
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// Ambient fog warna kosmik
scene.fog = new THREE.FogExp2(0x000510, 0.008);

// ────────────────────────────────────────────
// PARTICLE SYSTEM
// ────────────────────────────────────────────
const particleSystem = new ParticleSystem(scene, camera, renderer, PARTICLE_COUNT);

// Pre-build semua formasi (dilakukan sekali, bukan per-frame)
const formations = {
  none   : FormationBuilder.buildFloatFormation(PARTICLE_COUNT),
  text   : FormationBuilder.buildTextFormation(PARTICLE_COUNT),
  saturn : FormationBuilder.buildSaturnFormation(PARTICLE_COUNT),
  cube   : FormationBuilder.buildCubeFormation(PARTICLE_COUNT),
  heart  : FormationBuilder.buildHeartFormation(PARTICLE_COUNT),
  scatter: FormationBuilder.buildScatterFormation(PARTICLE_COUNT)
};

// Set formasi awal: float bebas
particleSystem.setFormation(formations.none, 'none');

// ────────────────────────────────────────────
// HAND TRACKER
// ────────────────────────────────────────────
const handTracker = new HandTracker();

// State tangan yang di-lerp untuk UI dan partikel
let smoothHandX  = 0;
let smoothHandY  = 0;
let smoothRot    = 0;

// Lerp tambahan di main loop (di atas lerp HandTracker)
const HAND_LERP  = 0.12;

// ────────────────────────────────────────────
// WEBCAM
// ────────────────────────────────────────────
const video = document.getElementById('webcam');

async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
      audio: false
    });
    video.srcObject = stream;
    await new Promise(res => video.onloadedmetadata = res);
    video.play();
    console.log('[Main] Webcam started');
  } catch (e) {
    console.error('[Main] Webcam error:', e);
    updateUI('none', '⚠️ Camera denied');
  }
}

// ────────────────────────────────────────────
// UI HELPERS
// ────────────────────────────────────────────
const fingerCountEl  = document.getElementById('finger-count');
const gestureLabelEl = document.getElementById('gesture-label');
const fpsEl          = document.getElementById('fps-counter');
const loadingScreen  = document.getElementById('loading-screen');
const loadingFill    = document.getElementById('loading-fill');

const gestureLabels = {
  none   : 'Floating freely…',
  text   : '✍️ Forming "By Arif"',
  saturn : '🪐 Forming Saturn',
  cube   : '📦 Forming 3D Cube',
  heart  : '❤️ Forming Heart',
  scatter: '💥 Scattering!'
};

const fingerIcons = { 0:'✋', 1:'☝️', 2:'✌️', 3:'🤟', 4:'🖖', 5:'🖐️' };

function updateUI(gesture, label = null) {
  const fingers  = handTracker.smoothed.fingerCount;
  const icon     = fingerIcons[fingers] || '✋';
  fingerCountEl.textContent  = `${icon} ${fingers} finger${fingers !== 1 ? 's' : ''}`;
  gestureLabelEl.textContent = label || gestureLabels[gesture] || '...';
}

// ────────────────────────────────────────────
// FPS COUNTER (lightweight)
// ────────────────────────────────────────────
let fpsFrames = 0;
let fpsLast   = performance.now();
let fpsValue  = 60;

function tickFPS() {
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 500) {
    fpsValue  = Math.round(fpsFrames * 1000 / (now - fpsLast));
    fpsFrames = 0;
    fpsLast   = now;
    fpsEl.textContent = `FPS: ${fpsValue}`;
    // Adaptive: turunkan partikel kalau FPS drop (opsional monitoring)
  }
}

// ────────────────────────────────────────────
// GESTURE → FORMATION MAPPING
// ────────────────────────────────────────────
handTracker.onGestureChange = (gesture) => {
  // Ambil formation yang sudah di-cache
  const formation = formations[gesture] || formations.none;
  particleSystem.setFormation(formation, gesture);
  updateUI(gesture);

  // Scatter: setelah 2.5 detik otomatis kembali ke float
  if (gesture === 'scatter') {
    setTimeout(() => {
      // Hanya reset jika masih di scatter (tangan mungkin sudah berubah)
      if (handTracker.smoothed.gesture === 'scatter' ||
          handTracker.smoothed.gesture === 'none') {
        particleSystem.setFormation(formations.none, 'none');
        particleSystem.morphTarget = 'none';
        updateUI('none');
      }
    }, 2500);
  }
};

// ────────────────────────────────────────────
// RENDER LOOP
// ────────────────────────────────────────────
let startTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const time = (performance.now() - startTime) / 1000;

  // ── Hand tracking (throttled di dalam processFrame)
  handTracker.processFrame(video);

  // ── Smooth lerp posisi tangan di main loop (lapisan kedua)
  const hs = handTracker.smoothed;
  smoothHandX = smoothHandX + (hs.handX - smoothHandX) * HAND_LERP;
  smoothHandY = smoothHandY + (hs.handY - smoothHandY) * HAND_LERP;

  // Lerp sudut (hindari wrap jump)
  let rotDiff = hs.rotation - smoothRot;
  while (rotDiff >  Math.PI) rotDiff -= Math.PI * 2;
  while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
  smoothRot += rotDiff * HAND_LERP;

  // ── Update partikel
  particleSystem.update(time, smoothHandX, smoothHandY, smoothRot);

  // ── Render
  renderer.render(scene, camera);

  tickFPS();
}

// ────────────────────────────────────────────
// RESIZE HANDLER
// ────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ────────────────────────────────────────────
// INIT — LOADING SEQUENCE
// ────────────────────────────────────────────
async function init() {
  // Progress bar animasi
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 15, 85);
    loadingFill.style.width = progress + '%';
  }, 200);

  try {
    // Start webcam & MediaPipe secara paralel
    await Promise.all([
      startWebcam(),
      handTracker.init()
    ]);
  } catch (e) {
    console.error('[Main] Init error:', e);
  }

  // Selesai
  clearInterval(progressInterval);
  loadingFill.style.width = '100%';
  await new Promise(r => setTimeout(r, 400));

  // Sembunyikan loading screen
  loadingScreen.classList.add('hidden');
  setTimeout(() => { loadingScreen.style.display = 'none'; }, 900);

  // Mulai render loop
  animate();
  console.log('[Main] Application started');
}

init();
    
