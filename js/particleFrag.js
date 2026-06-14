// shaders/particle.frag.glsl
// Stored as JS template literal

export const particleFragmentShader = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uMorphT;
  uniform float uScatter;

  varying float vDist;
  varying float vRandom;
  varying float vAlpha;

  void main() {
    // Circular point
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // Soft glow core
    float core  = 1.0 - smoothstep(0.0, 0.22, d);
    float halo  = 1.0 - smoothstep(0.15, 0.5, d);
    float glow  = core * 1.4 + halo * 0.6;

    // Color palette — cycle per particle
    float hue = fract(vRandom * 3.7 + uTime * 0.04);

    vec3 colA = vec3(0.0, 0.83, 1.0);   // cyan
    vec3 colB = vec3(0.48, 0.18, 1.0);  // purple
    vec3 colC = vec3(1.0,  0.18, 0.85); // magenta
    vec3 colD = vec3(0.9,  0.95, 1.0);  // white-blue

    vec3 color;
    if      (hue < 0.25) color = mix(colA, colB, hue * 4.0);
    else if (hue < 0.5)  color = mix(colB, colC, (hue - 0.25) * 4.0);
    else if (hue < 0.75) color = mix(colC, colD, (hue - 0.5) * 4.0);
    else                  color = mix(colD, colA, (hue - 0.75) * 4.0);

    // Boost brightness for formed particles
    float formBoost = 1.0 + uMorphT * (1.0 - uScatter) * 0.6;
    color *= formBoost;

    float alpha = glow * vAlpha;
    gl_FragColor = vec4(color * glow, alpha);
  }
`;