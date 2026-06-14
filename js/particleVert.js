// shaders/particle.vert.glsl
// Stored as JS template literal and imported by main.js

export const particleVertexShader = /* glsl */`
  precision highp float;

  attribute vec3  aTargetPos;   // morph target position
  attribute float aRandom;      // per-particle random [0..1]
  attribute float aSize;        // base size

  uniform float uTime;
  uniform float uMorphT;        // [0..1] lerp toward target
  uniform float uScatter;       // [0..1] scatter force
  uniform vec3  uHandPos;       // hand position in world space
  uniform float uHandScale;     // scale from hand depth
  uniform mat4  uHandRot;       // hand rotation matrix
  uniform float uGlow;

  varying float vDist;
  varying float vRandom;
  varying float vAlpha;

  // Simple hash function
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vRandom = aRandom;

    // Scattered cosmic position (each particle has a unique "rest" derived from aRandom)
    float rx = (hash(aRandom * 17.3)  - 0.5) * 24.0;
    float ry = (hash(aRandom * 31.7)  - 0.5) * 14.0;
    float rz = (hash(aRandom * 53.1)  - 0.5) * 10.0;
    vec3 scatterPos = vec3(rx, ry, rz);

    // Drift animation for scattered particles
    float driftSpeed = 0.18 + aRandom * 0.12;
    float driftAmt   = sin(uTime * driftSpeed + aRandom * 6.283) * 0.35;
    scatterPos.y += driftAmt;
    scatterPos.x += cos(uTime * driftSpeed * 0.7 + aRandom * 3.14) * 0.2;

    // Apply hand transform to target position
    vec3 tPos = aTargetPos * uHandScale;
    vec3 rotPos = (uHandRot * vec4(tPos, 0.0)).xyz;
    vec3 worldTarget = rotPos + uHandPos;

    // Blend between scatter and formed shape
    float formT = clamp(uMorphT, 0.0, 1.0);
    float scatterT = clamp(uScatter, 0.0, 1.0);

    // Smooth easing
    float t = formT * formT * (3.0 - 2.0 * formT);
    float s = scatterT * scatterT * (3.0 - 2.0 * scatterT);

    vec3 pos = mix(mix(scatterPos, worldTarget, t), scatterPos, s);

    // Size calculation
    float sz = aSize * (1.0 + sin(uTime * 1.2 + aRandom * 6.28) * 0.15);
    sz *= uHandScale * 0.5 + 0.5;

    vDist = length(pos);
    vAlpha = 0.6 + 0.4 * formT * (1.0 - scatterT);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp(sz * (500.0 / -( modelViewMatrix * vec4(pos,1.0) ).z), 1.0, 12.0);
  }
`;