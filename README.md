# 🌌 Cosmic Hand Tracker — By Arif

Interactive particle art controlled by hand gestures in real-time. 3,000 GPU-rendered cosmic particles respond to your fingers via webcam.

---

## ✨ Features

| Gesture | Effect |
|---------|--------|
| ☝️ 1 finger | Particles form **"By Arif"** text |
| ✌️ 2 fingers | Particles form **Saturn** with rings |
| 🤟 3 fingers | Particles form a rotating **Cube** |
| 🫰 Love sign | Particles form a **Heart** |
| 🤚 Open hand | Particles **scatter** as cosmic dust |

- All shapes **follow your hand position** in real-time
- Hand **rotation** rotates the shape
- Hand **depth** (distance from camera) scales the shape
- **Smooth morphing** — particles glide to new positions with easing
- Cosmic background with **twinkling stars** and **nebula clouds**
- Full **GPU rendering** via Three.js + GLSL shaders

---

## 🚀 Quick Start

### Option A — Single File (Easiest)
Open `cosmic-hand-tracker.html` via a local server:

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code
# Install "Live Server" extension → Right-click → Open with Live Server
```

Then visit: `http://localhost:8080/cosmic-hand-tracker.html`

> ⚠️ **MUST use a local server** — camera APIs require `localhost` or `https://`
> Opening the file directly via `file://` will block camera access.

### Option B — Multi-file Version
```bash
cd cosmic-hand-tracker/
python3 -m http.server 8080
# Visit http://localhost:8080/
```

---

## 🏗️ Architecture

```
cosmic-hand-tracker/
├── index.html              # Entry point (multi-file version)
├── cosmic-hand-tracker.html # Self-contained single file
├── css/
│   └── style.css           # Full-screen cosmic UI styles
└── js/
    ├── main.js             # Application orchestrator
    ├── handTracker.js      # MediaPipe wrapper + gesture detection
    ├── particleSystem.js   # Three.js particle engine
    ├── particleVert.js     # GPU vertex shader (morph + scatter)
    ├── particleFrag.js     # GPU fragment shader (glow + color)
    ├── cosmicBackground.js # Stars + nebula particle system
    └── shapes.js           # Procedural shape generators
```

### Core Systems

#### 1. Hand Tracking (`handTracker.js`)
- Uses **MediaPipe Hand Landmarker** (GPU delegate)
- Throttled to **~30 FPS** detection to save CPU
- **Temporal smoothing** with lerp on all 21 landmarks
- **Gesture stabilization** — requires 6 consecutive identical frames to commit
- Detects: 1/2/3/5 fingers, Love sign (thumb + pinky extended, index curled)

#### 2. Particle System (`particleSystem.js`)
- **3,000 particles** — BufferGeometry, never reallocated
- All transforms happen **on the GPU** in GLSL
- Single draw call per frame
- `aTargetPos` attribute drives morph — only updated on gesture change

#### 3. Vertex Shader — Morph Logic
```
finalPos = mix(mix(scatterPos, worldTarget, morphT), scatterPos, scatterT)
```
- `scatterPos` — deterministic cosmic position from `aRandom`
- `worldTarget` — shape position in hand-space, transformed by hand matrix
- `morphT` — [0→1] lerp toward formed shape
- `scatterT` — [0→1] lerp back to scatter (for 5-finger / no-hand)

#### 4. Shape Generators (`shapes.js`)
All shapes pre-computed once at startup, stored as `Float32Array`:
- **Text**: Pixel font bitmap → sampled with jitter
- **Saturn**: Solid sphere + angled ring bands (4 bands, varying density)
- **Cube**: Weighted split — 50% edges, 30% faces, 20% vertices
- **Heart**: Parametric heart curve `x=16sin³t, y=13cos t − 5cos 2t − ...`
- **Scatter**: Zero array (shader handles via `aRandom` + `uTime`)

#### 5. Performance Optimizations
- ✅ `Float32Array` for all geometry — no garbage
- ✅ All shape buffers pre-generated at load
- ✅ Hand detection throttled (33ms interval)
- ✅ Gesture stabilization prevents excessive `setGesture` calls
- ✅ `BufferAttribute.needsUpdate` only when gesture changes
- ✅ Zero allocations in render loop
- ✅ `THREE.AdditiveBlending` — transparent particles without sorting
- ✅ `frustumCulled = false` — skip per-frame frustum math for scattered particles
- ✅ GPU delegate for MediaPipe inference

---

## 🌐 Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Firefox 90+ | ⚠️ MediaPipe may need flags |
| Safari 16+ | ⚠️ Limited WebGPU |

**Requires:** Camera permission, WebGL 2.0, ES Modules

---

## 🔒 Privacy

- All processing runs **100% in your browser**
- Camera feed is **never uploaded** to any server
- MediaPipe runs **locally** via WASM + WebGPU
- No analytics, no tracking, no cookies

---

## 🎨 Tech Stack

- **Three.js r165** — WebGL rendering
- **MediaPipe Tasks Vision 0.10.14** — Hand Landmarker
- **GLSL** — Custom vertex + fragment shaders
- Vanilla ES Modules — no build step required