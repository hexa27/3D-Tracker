// ============================================
// SHADERS — Custom GLSL untuk efek partikel
// ============================================

export const particleVertexShader = `
  // Atribut per-partikel
  attribute float aSize;      // ukuran dasar partikel
  attribute vec3  aColor;     // warna partikel
  attribute float aAlpha;     // transparansi
  attribute float aGlow;      // intensitas glow

  // Varying diteruskan ke fragment shader
  varying vec3  vColor;
  varying float vAlpha;
  varying float vGlow;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vGlow  = aGlow;

    // Hitung posisi clip-space
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Ukuran partikel berbasis jarak (perspective sizing)
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    // Clamp agar tidak terlalu besar atau terlalu kecil
    gl_PointSize = clamp(gl_PointSize, 1.0, 24.0);
  }
`;

export const particleFragmentShader = `
  varying vec3  vColor;
  varying float vAlpha;
  varying float vGlow;

  void main() {
    // Koordinat polar dari pusat titik (0..1)
    vec2  coord = gl_PointCoord - vec2(0.5);
    float dist  = length(coord);

    // Potong di luar lingkaran
    if (dist > 0.5) discard;

    // Core cerah di tengah, memudar ke tepi (soft glow)
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    float halo = 1.0 - smoothstep(0.15, 0.5, dist);

    // Gabungkan core + halo dengan intensitas glow
    float brightness = core + halo * vGlow * 0.6;

    vec3  finalColor = vColor * brightness;
    float finalAlpha = vAlpha * halo;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

// Shader bintang latar belakang (lebih sederhana)
export const starVertexShader = `
  attribute float aSize;
  attribute float aTwinkle;   // fase kedip berbeda tiap bintang
  uniform float   uTime;

  void main() {
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.6 + 0.4 * sin(uTime * 1.5 + aTwinkle * 6.2831);
    gl_PointSize = aSize * twinkle;
  }
`;

export const starFragmentShader = `
  void main() {
    vec2  coord = gl_PointCoord - vec2(0.5);
    float dist  = length(coord);
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.8);
  }
`;
