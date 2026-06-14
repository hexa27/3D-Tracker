# 🌌 Cosmic Finger Tracker

Website interaktif finger tracking real-time berbasis WebGL + MediaPipe.
Ubah formasi ribuan partikel hanya dengan gestur tangan di depan webcam.

## 🚀 Cara Menjalankan

Karena menggunakan ES Modules dan akses kamera, **harus dijalankan via HTTP server** (bukan buka file HTML langsung).

### Opsi 1 — VS Code Live Server (Paling Mudah)
1. Install ekstensi **Live Server** di VS Code
2. Klik kanan `index.html` → **Open with Live Server**
3. Browser otomatis terbuka di `[127.0.0.1](http://127.0.0.1:5500)`

### Opsi 2 — Python (Built-in)
```bash
# Python 3
cd cosmic-finger-tracker
python -m http.server 8080
# Buka: [localhost](http://localhost:8080)
```

### Opsi 3 — Node.js
```bash
npx serve .
# Atau:
npx http-server -p 8080
```

## 🎮 Gesture Guide

| Gesture | Aksi |
|---------|------|
| ☝️ 1 Jari | Partikel membentuk teks **"By Arif"** |
| ✌️ 2 Jari | Partikel membentuk **Planet Saturnus** |
| 🤟 3 Jari | Partikel membentuk **Kubus 3D** |
| 🫰 Love Sign | Partikel membentuk **Hati** |
| 🖐️ 5 Jari | Partikel **meledak & menyebar**, lalu kembali mengambang |

**Pergerakan Tangan:**
- Gerak kiri/kanan/atas/bawah → formasi mengikuti
- Putar tangan → formasi ikut berputar

## 📋 Persyaratan Browser
- Chrome / Edge 90+ (disarankan)
- Firefox 90+ (WebGPU/GPU delegate mungkin fallback ke CPU)
- Izin akses **kamera** diperlukan

## 🛠️ Teknologi
- **Three.js r128** — rendering partikel GPU
- **MediaPipe Hand Landmarker 0.10** — hand tracking real-time
- **Custom GLSL Shaders** — efek glow & additive blending
- **ES Modules** — modular, zero build tool

## ⚙️ Optimasi Performa
- BufferGeometry + pre-allocated Float32Arrays (nol alokasi per-frame)
- Throttled hand tracking (maks 30 fps inferensi)
- Double-layer exponential smoothing (HandTracker + main loop)
- Additive blending GPU shader
- DPR capped at 2× untuk layar retina
- Formation pre-built saat startup (bukan saat gesture)
