// js/cosmicBackground.js
// Starfield + nebula effect using Three.js Points + ShaderMaterial

import * as THREE from 'three';

const STAR_COUNT  = 2000;
const NEBULA_COUNT = 600;

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}

/* ── Star vertex shader ──────────────────────────────────── */
const starVert = /* glsl */`
  attribute float aSize;
  attribute float aRandom;
  uniform float uTime;
  varying float vRandom;

  void main() {
    vRandom = aRandom;
    float twinkle = 0.7 + 0.3 * sin(uTime * (1.0 + aRandom * 3.0) + aRandom * 6.28);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * twinkle;
  }
`;
const starFrag = /* glsl */`
  varying float vRandom;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = (1.0 - smoothstep(0.0, 0.5, d)) * (0.5 + vRandom * 0.5);
    // Star color: white to warm blue
    vec3 col = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 1.0, 1.0), vRandom);
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ── Nebula vertex shader ────────────────────────────────── */
const nebulaVert = /* glsl */`
  attribute float aSize;
  attribute float aRandom;
  attribute vec3  aColor;
  uniform float uTime;
  varying float vRandom;
  varying vec3  vColor;

  void main() {
    vRandom = aRandom;
    vColor  = aColor;
    vec3 pos = position;
    pos.x += sin(uTime * 0.08 + aRandom * 6.28) * 0.3;
    pos.y += cos(uTime * 0.06 + aRandom * 3.14) * 0.2;
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 + 0.2 * sin(uTime * 0.5 + aRandom * 10.0));
  }
`;
const nebulaFrag = /* glsl */`
  varying float vRandom;
  varying vec3  vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = (1.0 - smoothstep(0.0, 0.5, d)) * 0.12;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export class CosmicBackground {
  constructor(scene) {
    this.scene = scene;
    this._buildStars();
    this._buildNebula();
  }

  _buildStars() {
    const r = lcg(777);
    const geo = new THREE.BufferGeometry();
    const pos  = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const rand = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      pos[i*3]   = (r() - 0.5) * 80;
      pos[i*3+1] = (r() - 0.5) * 50;
      pos[i*3+2] = -20 - r() * 30;
      size[i]    = 1.0 + r() * 2.5;
      rand[i]    = r();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aRandom',  new THREE.BufferAttribute(rand, 1));

    this._starMat = new THREE.ShaderMaterial({
      vertexShader:   starVert,
      fragmentShader: starFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    this.stars = new THREE.Points(geo, this._starMat);
    this.scene.add(this.stars);
  }

  _buildNebula() {
    const r = lcg(321);
    const geo = new THREE.BufferGeometry();
    const pos   = new Float32Array(NEBULA_COUNT * 3);
    const size  = new Float32Array(NEBULA_COUNT);
    const rand  = new Float32Array(NEBULA_COUNT);
    const color = new Float32Array(NEBULA_COUNT * 3);

    // Nebula cloud centers
    const clouds = [
      { cx: -6, cy:  3, cz: -8, r: 8, col: [0.3, 0.1, 0.9] },  // purple
      { cx:  8, cy: -2, cz: -10, r: 7, col: [0.0, 0.6, 1.0] },  // cyan
      { cx:  0, cy:  5, cz: -12, r: 6, col: [0.7, 0.1, 0.9] },  // magenta
      { cx: -4, cy: -4, cz: -6,  r: 5, col: [0.0, 0.3, 0.8] },  // blue
    ];

    for (let i = 0; i < NEBULA_COUNT; i++) {
      const cl = clouds[Math.floor(r() * clouds.length)];
      const theta = r() * Math.PI * 2;
      const phi   = Math.acos(2 * r() - 1);
      const rad   = r() * cl.r;
      pos[i*3]   = cl.cx + rad * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = cl.cy + rad * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = cl.cz + (r()-0.5) * 4;
      size[i]    = 20 + r() * 60;
      rand[i]    = r();
      color[i*3]   = cl.col[0];
      color[i*3+1] = cl.col[1];
      color[i*3+2] = cl.col[2];
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aRandom',  new THREE.BufferAttribute(rand, 1));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(color, 3));

    this._nebMat = new THREE.ShaderMaterial({
      vertexShader:   nebulaVert,
      fragmentShader: nebulaFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    this.nebula = new THREE.Points(geo, this._nebMat);
    this.scene.add(this.nebula);
  }

  update(time) {
    this._starMat.uniforms.uTime.value = time;
    this._nebMat.uniforms.uTime.value  = time;
  }

  dispose() {
    this.stars.geometry.dispose();  this._starMat.dispose();
    this.nebula.geometry.dispose(); this._nebMat.dispose();
    this.scene.remove(this.stars, this.nebula);
  }
}