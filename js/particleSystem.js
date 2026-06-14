// js/particleSystem.js
// GPU-accelerated particle system using Three.js BufferGeometry + custom shaders

import * as THREE from 'three';
import { particleVertexShader }   from './particleVert.js';
import { particleFragmentShader } from './particleFrag.js';
import { makeTextShape, makeSaturnShape, makeCubeShape, makeHeartShape, makeScatterShape } from './shapes.js';
import { GESTURE } from './handTracker.js';

const PARTICLE_COUNT = 3000;
const MORPH_DURATION = 1.4; // seconds

/* ── Deterministic RNG ────────────────────────────────────── */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.count = PARTICLE_COUNT;

    // Pre-allocate all typed arrays once — reused every frame
    this._targetPositions = new Float32Array(this.count * 3);
    this._currentGesture = GESTURE.NONE;

    // Morph state
    this._morphStart  = null;
    this._morphFrom   = new Float32Array(this.count * 3);
    this._morphTo     = new Float32Array(this.count * 3);
    this._morphT      = 0;
    this._isMorphing  = false;
    this._scatterT    = 1; // start scattered

    // Pre-generate all shape buffers
    this._shapes = {
      [GESTURE.ONE]:   makeTextShape(this.count),
      [GESTURE.TWO]:   makeSaturnShape(this.count),
      [GESTURE.THREE]: makeCubeShape(this.count),
      [GESTURE.LOVE]:  makeHeartShape(this.count),
      [GESTURE.FIVE]:  makeScatterShape(this.count),
      [GESTURE.NONE]:  makeScatterShape(this.count),
    };

    // Hand state (smoothed externally, read here)
    this.handPos   = new THREE.Vector3(0, 0, 0);
    this.handScale = 1.0;
    this.handRot   = new THREE.Matrix4();

    this._buildGeometry();
    this._buildMaterial();
    this._buildMesh();
  }

  _buildGeometry() {
    this.geometry = new THREE.BufferGeometry();
    const r = lcg(12345);

    // Base scatter positions (used as initial state)
    const positions  = new Float32Array(this.count * 3);
    const randoms    = new Float32Array(this.count);
    const sizes      = new Float32Array(this.count);
    const targets    = new Float32Array(this.count * 3); // morph target

    for (let i = 0; i < this.count; i++) {
      positions[i*3]   = (r() - 0.5) * 24;
      positions[i*3+1] = (r() - 0.5) * 14;
      positions[i*3+2] = (r() - 0.5) * 10;
      randoms[i] = r();
      sizes[i]   = 2.0 + r() * 4.0;
      targets[i*3]   = 0;
      targets[i*3+1] = 0;
      targets[i*3+2] = 0;
    }

    // Store initial positions as morphFrom baseline
    this._morphFrom.set(positions);

    this.geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aTargetPos', new THREE.BufferAttribute(targets, 3));
    this.geometry.setAttribute('aRandom',    new THREE.BufferAttribute(randoms, 1));
    this.geometry.setAttribute('aSize',      new THREE.BufferAttribute(sizes, 1));

    // Cache attribute references to avoid repeated .getAttribute calls
    this._attrTarget   = this.geometry.getAttribute('aTargetPos');
    this._attrPos      = this.geometry.getAttribute('position');
  }

  _buildMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader:   particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uTime:      { value: 0 },
        uMorphT:    { value: 0 },
        uScatter:   { value: 1 },
        uHandPos:   { value: new THREE.Vector3() },
        uHandScale: { value: 1.0 },
        uHandRot:   { value: new THREE.Matrix4() },
        uGlow:      { value: 1.0 },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
  }

  _buildMesh() {
    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false; // particles span whole scene
    this.scene.add(this.mesh);
  }

  /* ── Called externally when gesture changes ─────────────── */
  setGesture(gesture) {
    if (gesture === this._currentGesture) return;
    this._currentGesture = gesture;

    const targetShape = this._shapes[gesture] || this._shapes[GESTURE.NONE];

    // Copy current target as morph source
    this._morphFrom.set(this._attrTarget.array);
    this._morphTo.set(targetShape);

    // Update GPU target buffer with new target
    this._attrTarget.array.set(targetShape);
    this._attrTarget.needsUpdate = true;

    // Handle scatter flag
    if (gesture === GESTURE.FIVE || gesture === GESTURE.NONE) {
      this._morphT  = 0;
      this._scatterT = 1;
    } else {
      this._scatterT = 0;
      this._morphT   = 0;
    }

    this._morphStart = null; // reset timer, will be set in update
    this._isMorphing = true;
  }

  /* ── Main update — called every animation frame ─────────── */
  update(time, delta) {
    const uni = this.material.uniforms;
    uni.uTime.value = time;

    // Morph animation
    if (this._isMorphing) {
      if (this._morphStart === null) this._morphStart = time;
      const elapsed = time - this._morphStart;
      const t = Math.min(elapsed / MORPH_DURATION, 1.0);

      if (this._currentGesture === GESTURE.FIVE || this._currentGesture === GESTURE.NONE) {
        uni.uMorphT.value  = 0;
        uni.uScatter.value = t * t * (3 - 2*t); // smooth step
      } else {
        uni.uMorphT.value  = t * t * (3 - 2*t);
        uni.uScatter.value = 0;
      }

      if (t >= 1.0) this._isMorphing = false;
    }

    // Pass hand data to shader
    uni.uHandPos.value.copy(this.handPos);
    uni.uHandScale.value = this.handScale;
    uni.uHandRot.value.copy(this.handRot);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }
}