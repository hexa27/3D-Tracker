// ============================================
// PARTICLE SYSTEM
// Three.js BufferGeometry + custom shader.
// Object pooling, zero allocation per-frame.
// ============================================

import {
  particleVertexShader,
  particleFragmentShader,
  starVertexShader,
  starFragmentShader
} from './shaders.js';

export class ParticleSystem {

  /**
   * @param {THREE.Scene}    scene
   * @param {THREE.Camera}   camera
   * @param {THREE.Renderer} renderer
   * @param {number}         count  jumlah partikel
   */
  constructor(scene, camera, renderer, count = 2000) {
    this.scene    = scene;
    this.camera   = camera;
    this.renderer = renderer;
    this.count    = count;

    // ── Target & posisi saat ini (pre-allocated Float32Arrays)
    this.positions    = new Float32Array(count * 3); // posisi real-time
    this.targets      = new Float32Array(count * 3); // posisi tujuan morphing
    this.velocities   = new Float32Array(count * 3); // kecepatan partikel
    this.colors       = new Float32Array(count * 3);
    this.sizes        = new Float32Array(count);
    this.alphas       = new Float32Array(count);
    this.glows        = new Float32Array(count);
    this.phases       = new Float32Array(count);   // fase float idle tiap partikel

    // ── Konfigurasi morfing
    this.morphSpeed   = 0.06;   // kecepatan lerp (0..1 per update)
    this.isMorphing   = false;
    this.morphTarget  = 'none';

    // ── Offset posisi (dari tracking tangan)
    this.offsetX = 0;
    this.offsetY = 0;
    this.rotation = 0;         // rotasi global formasi

    // ── Rotasi matrix reusable (hindari alokasi per frame)
    this._cosR = 1;
    this._sinR = 0;

    this._initGeometry();
    this._initStars();
    this._initPositions();
  }

  // ─── Setup BufferGeometry partikel ────────
  _initGeometry() {
    this.geometry = new THREE.BufferGeometry();

    // Registrasi semua atribut — pre-allocated, tidak realokasi
    this.posAttr   = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors,    3);
    this.sizeAttr  = new THREE.BufferAttribute(this.sizes,     1);
    this.alphaAttr = new THREE.BufferAttribute(this.alphas,    1);
    this.glowAttr  = new THREE.BufferAttribute(this.glows,     1);

    this.posAttr.setUsage(THREE.DynamicDrawUsage);   // update tiap frame
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aColor',   this.colorAttr);
    this.geometry.setAttribute('aSize',    this.sizeAttr);
    this.geometry.setAttribute('aAlpha',   this.alphaAttr);
    this.geometry.setAttribute('aGlow',    this.glowAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader  : particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent   : true,
      depthWrite    : false,
      blending      : THREE.AdditiveBlending  // glow additive
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  // ─── Bintang latar belakang ───────────────
  _initStars() {
    const starCount = 1200;
    const pos   = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const twink = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Tempatkan bintang di sphere radius besar
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 80 + Math.random() * 40;
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.cos(phi);
      pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i]   = 0.8 + Math.random() * 2.0;
      twink[i]   = Math.random(); // fase kedip
    }

    const geo  = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aTwinkle', new THREE.BufferAttribute(twink, 1));

    this.starUniforms = { uTime: { value: 0 } };

    const mat  = new THREE.ShaderMaterial({
      vertexShader  : starVertexShader,
      fragmentShader: starFragmentShader,
      uniforms      : this.starUniforms,
      transparent   : true,
      depthWrite    : false,
      blending      : THREE.AdditiveBlending
    });

    this.starMesh = new THREE.Points(geo, mat);
    this.scene.add(this.starMesh);
  }

  // ─── Posisi awal partikel (float bebas) ───
  _initPositions() {
    const palette = [
      [0.3, 0.6, 1.0],   // biru
      [0.6, 0.3, 1.0],   // ungu
      [0.3, 0.9, 1.0],   // cyan
      [1.0, 1.0, 1.0],   // putih
      [0.5, 0.2, 0.9]    // indigo
    ];

    for (let i = 0; i < this.count; i++) {
      // Posisi acak tersebar
      const x = (Math.random() - 0.5) * 18;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 6;
      this.positions[i*3]   = x;
      this.positions[i*3+1] = y;
      this.positions[i*3+2] = z;
      this.targets[i*3]     = x;
      this.targets[i*3+1]   = y;
      this.targets[i*3+2]   = z;

      // Warna dari palette
      const c = palette[i % palette.length];
      const variation = 0.85 + Math.random() * 0.15;
      this.colors[i*3]   = c[0] * variation;
      this.colors[i*3+1] = c[1] * variation;
      this.colors[i*3+2] = c[2] * variation;

      this.sizes[i]  = 1.5 + Math.random() * 2.5;
      this.alphas[i] = 0.6 + Math.random() * 0.4;
      this.glows[i]  = 0.5 + Math.random() * 0.5;
      this.phases[i] = Math.random() * Math.PI * 2;

      // Velocity awal nol
      this.velocities[i*3]   = 0;
      this.velocities[i*3+1] = 0;
      this.velocities[i*3+2] = 0;
    }

    // Upload ke GPU
    this.posAttr.needsUpdate   = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate  = true;
    this.alphaAttr.needsUpdate = true;
    this.glowAttr.needsUpdate  = true;
  }

  // ─── Set formasi target baru ──────────────
  /**
   * @param {Array<[x,y,z]>} formationPoints  array posisi target
   * @param {string}          gestureName
   */
  setFormation(formationPoints, gestureName) {
    if (this.morphTarget === gestureName) return; // sudah di formasi ini
    this.morphTarget = gestureName;
    this.isMorphing  = true;

    const isScatter = gestureName === 'scatter';

    for (let i = 0; i < this.count; i++) {
      const src = formationPoints[i];
      this.targets[i*3]   = src[0];
      this.targets[i*3+1] = src[1];
      this.targets[i*3+2] = src[2];

      // Untuk scatter: tambahkan impulse awal
      if (isScatter) {
        this.velocities[i*3]   = (Math.random()-0.5) * 0.3;
        this.velocities[i*3+1] = (Math.random()-0.5) * 0.3;
        this.velocities[i*3+2] = (Math.random()-0.5) * 0.2;
      }
    }

    // Sesuaikan warna berdasarkan gesture
    this._updateColors(gestureName);
  }

  // ─── Update warna sesuai gesture ─────────
  _updateColors(gesture) {
    const themes = {
      text   : [[0.3,0.8,1.0],[0.5,1.0,1.0],[0.7,0.9,1.0]],
      saturn : [[0.9,0.7,0.4],[1.0,0.85,0.5],[0.8,0.6,0.3]],
      cube   : [[0.2,0.5,1.0],[0.4,0.3,0.9],[0.3,0.7,1.0]],
      heart  : [[1.0,0.3,0.5],[1.0,0.5,0.7],[0.9,0.2,0.4]],
      scatter: [[0.8,0.3,1.0],[0.3,0.8,1.0],[1.0,0.8,0.3]],
      none   : [[0.3,0.6,1.0],[0.6,0.3,1.0],[0.3,0.9,1.0]]
    };
    const palette = themes[gesture] || themes.none;

    for (let i = 0; i < this.count; i++) {
      const c = palette[i % palette.length];
      const v = 0.8 + Math.random() * 0.2;
      this.colors[i*3]   = c[0] * v;
      this.colors[i*3+1] = c[1] * v;
      this.colors[i*3+2] = c[2] * v;
    }
    this.colorAttr.needsUpdate = true;
  }

  // ─── Update frame utama ───────────────────
  /**
   * @param {number} time      waktu dalam detik (dari performance.now)
   * @param {number} offsetX   posisi tangan -1..1
   * @param {number} offsetY
   * @param {number} rotation  rad
   */
  update(time, offsetX = 0, offsetY = 0, rotation = 0) {
    // Precompute rotasi (hindari trig per-partikel)
    this._cosR = Math.cos(rotation);
    this._sinR = Math.sin(rotation);

    // Konversi offset tangan ke ruang dunia
    const worldX = offsetX * 5.0;
    const worldY = offsetY * 3.5;

    let anyMorphing = false;
    const lerpSpeed = this.morphTarget === 'scatter' ? 0.025 : this.morphSpeed;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      // ── Float idle: gerakan micro halus
      const floatX = Math.sin(time * 0.4 + this.phases[i])        * 0.015;
      const floatY = Math.cos(time * 0.35 + this.phases[i] * 1.3) * 0.012;
      const floatZ = Math.sin(time * 0.3  + this.phases[i] * 0.7) * 0.008;

      // ── Target dengan rotasi & offset tangan
      let tx = this.targets[i3];
      let ty = this.targets[i3+1];
      const tz = this.targets[i3+2];

      // Rotasi 2D di bidang XY
      const rotX = tx * this._cosR - ty * this._sinR;
      const rotY = tx * this._sinR + ty * this._cosR;

      const finalTX = rotX + worldX + floatX;
      const finalTY = rotY + worldY + floatY;
      const finalTZ = tz            + floatZ;

      // ── Lerp posisi saat ini ke target (easing eksponensial)
      const curX = this.positions[i3];
      const curY = this.positions[i3+1];
      const curZ = this.positions[i3+2];

      const dx = finalTX - curX;
      const dy = finalTY - curY;
      const dz = finalTZ - curZ;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist > 0.001) {
        anyMorphing = true;
        this.positions[i3]   = curX + dx * lerpSpeed;
        this.positions[i3+1] = curY + dy * lerpSpeed;
        this.positions[i3+2] = curZ + dz * lerpSpeed;
      } else {
        // Sudah sampai — hanya float
        this.positions[i3]   = finalTX;
        this.positions[i3+1] = finalTY;
        this.positions[i3+2] = finalTZ;
      }

      // ── Pulse alpha & glow saat idle
      const pulse = 0.85 + 0.15 * Math.sin(time * 1.2 + this.phases[i]);
      this.alphas[i] = (0.5 + Math.random() * 0.1) * pulse;
    }

    this.isMorphing = anyMorphing;

    // Upload hanya atribut yang berubah
    this.posAttr.needsUpdate   = true;
    this.alphaAttr.needsUpdate = true;

    // Update uniform waktu bintang
    this.starUniforms.uTime.value = time;
  }

  // ─── Resize handler ───────────────────────
  onResize(width, height) {
    // Camera aspect sudah dihandle di main.js
  }

  // ─── Dispose (cleanup) ────────────────────
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.starMesh.geometry.dispose();
    this.starMesh.material.dispose();
    this.scene.remove(this.mesh);
    this.scene.remove(this.starMesh);
  }
                                           }
