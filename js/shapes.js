// js/shapes.js
// Returns Float32Array of [x,y,z] positions (N * 3 floats) for each shape

const TWO_PI = Math.PI * 2;

/* ── Helpers ─────────────────────────────────────────────── */
function rng(seed) {
  // Deterministic LCG pseudo-random
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

function normalizeArray(arr) {
  // Find bounding box, center, and scale to unit-ish size
  let mx = -Infinity, my = -Infinity, mz = -Infinity;
  let nx = Infinity, ny = Infinity, nz = Infinity;
  for (let i = 0; i < arr.length; i += 3) {
    if (arr[i]   > mx) mx = arr[i];
    if (arr[i]   < nx) nx = arr[i];
    if (arr[i+1] > my) my = arr[i+1];
    if (arr[i+1] < ny) ny = arr[i+1];
    if (arr[i+2] > mz) mz = arr[i+2];
    if (arr[i+2] < nz) nz = arr[i+2];
  }
  const cx = (mx + nx) / 2, cy = (my + ny) / 2, cz = (mz + nz) / 2;
  const scale = Math.max(mx - nx, my - ny, mz - nz) || 1;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i]   = (arr[i]   - cx) / scale * 2;
    arr[i+1] = (arr[i+1] - cy) / scale * 2;
    arr[i+2] = (arr[i+2] - cz) / scale * 2;
  }
  return arr;
}

/* ── "By Arif" text shape ────────────────────────────────── */
// Pixel-art bitmaps for "By Arif" — 5×7 font
const FONT_MAP = {
  'B': [
    [1,1,1,0],
    [1,0,0,1],
    [1,1,1,0],
    [1,0,0,1],
    [1,0,0,1],
    [1,1,1,0],
    [0,0,0,0],
  ],
  'y': [
    [1,0,1,0],
    [1,0,1,0],
    [0,1,1,0],
    [0,0,1,0],
    [0,1,0,0],
    [0,0,0,0],
    [0,0,0,0],
  ],
  ' ': [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]],
  'A': [
    [0,1,1,0],
    [1,0,0,1],
    [1,1,1,1],
    [1,0,0,1],
    [1,0,0,1],
    [0,0,0,0],
    [0,0,0,0],
  ],
  'r': [
    [1,0,1,0],
    [1,1,0,0],
    [1,0,0,0],
    [1,0,0,0],
    [1,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
  ],
  'i': [
    [0,1,0,0],
    [0,0,0,0],
    [0,1,0,0],
    [0,1,0,0],
    [0,1,0,0],
    [0,0,0,0],
    [0,0,0,0],
  ],
  'f': [
    [0,1,1,0],
    [0,1,0,0],
    [1,1,1,0],
    [0,1,0,0],
    [0,1,0,0],
    [0,0,0,0],
    [0,0,0,0],
  ],
};

export function makeTextShape(count) {
  const positions = [];
  const text = 'By Arif';
  const charWidth = 5;
  const charHeight = 7;
  const spacing = 1;
  let cursorX = 0;

  for (const ch of text) {
    const bitmap = FONT_MAP[ch] || FONT_MAP[' '];
    const w = bitmap[0].length;
    for (let row = 0; row < bitmap.length; row++) {
      for (let col = 0; col < w; col++) {
        if (bitmap[row][col]) {
          positions.push(
            cursorX + col,
            -(row - charHeight / 2),
            0
          );
        }
      }
    }
    cursorX += (w || 2) + spacing;
  }

  // Convert pixel positions to Float32 and distribute particles
  const src = new Float32Array(positions);
  const out = new Float32Array(count * 3);
  const r = rng(42);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(r() * (src.length / 3));
    out[i*3]   = src[idx*3]   + (r() - 0.5) * 0.18;
    out[i*3+1] = src[idx*3+1] + (r() - 0.5) * 0.18;
    out[i*3+2] = (r() - 0.5) * 0.1;
  }
  return normalizeArray(out);
}

/* ── Saturn shape ────────────────────────────────────────── */
export function makeSaturnShape(count) {
  const out = new Float32Array(count * 3);
  const r = rng(7);

  // Distribution: 45% planet sphere, 55% rings
  const planetCount = Math.floor(count * 0.45);
  const ringCount = count - planetCount;

  // Planet: filled sphere
  for (let i = 0; i < planetCount; i++) {
    // Rejection sampling for solid sphere
    let x, y, z;
    do {
      x = (r() - 0.5) * 2;
      y = (r() - 0.5) * 2;
      z = (r() - 0.5) * 2;
    } while (x*x + y*y + z*z > 1);
    const scale = 0.72;
    out[i*3]   = x * scale;
    out[i*3+1] = y * scale;
    out[i*3+2] = z * scale * 0.85; // slight oblate
  }

  // Rings: flat annulus in XZ plane with multiple bands
  const ringBands = [
    { inner: 0.95, outer: 1.1,  density: 0.30 },
    { inner: 1.12, outer: 1.32, density: 0.40 },
    { inner: 1.35, outer: 1.55, density: 0.20 },
    { inner: 1.58, outer: 1.72, density: 0.10 },
  ];
  const totalDensity = ringBands.reduce((s, b) => s + b.density, 0);

  for (let i = 0; i < ringCount; i++) {
    let rand = r() * totalDensity;
    let band = ringBands[0];
    for (const b of ringBands) {
      if (rand < b.density) { band = b; break; }
      rand -= b.density;
    }
    const angle = r() * TWO_PI;
    const radius = band.inner + r() * (band.outer - band.inner);
    const tilt = 0.44; // ring tilt in radians (~25°)
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = (r() - 0.5) * 0.04; // thin ring thickness
    // Apply tilt rotation around X axis
    const yTilt = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zTilt = y * Math.sin(tilt) + z * Math.cos(tilt);
    const j = planetCount + i;
    out[j*3]   = x;
    out[j*3+1] = yTilt;
    out[j*3+2] = zTilt;
  }

  return normalizeArray(out);
}

/* ── Cube shape ──────────────────────────────────────────── */
export function makeCubeShape(count) {
  const out = new Float32Array(count * 3);
  const r = rng(13);

  // Distribution: edges (50%), faces (30%), vertices (20%)
  const edgeCount   = Math.floor(count * 0.50);
  const faceCount   = Math.floor(count * 0.30);
  const vertCount   = count - edgeCount - faceCount;

  const S = 1.0; // half-size

  // Vertices
  const verts = [];
  for (let x = -1; x <= 1; x += 2)
  for (let y = -1; y <= 1; y += 2)
  for (let z = -1; z <= 1; z += 2)
    verts.push([x*S, y*S, z*S]);

  for (let i = 0; i < vertCount; i++) {
    const v = verts[Math.floor(r() * verts.length)];
    out[i*3]   = v[0] + (r()-0.5)*0.04;
    out[i*3+1] = v[1] + (r()-0.5)*0.04;
    out[i*3+2] = v[2] + (r()-0.5)*0.04;
  }

  // Edges — 12 edges connecting vertices
  const edges = [
    // bottom face
    [-1,-1,-1],[1,-1,-1], [1,-1,-1],[1,-1,1], [1,-1,1],[-1,-1,1], [-1,-1,1],[-1,-1,-1],
    // top face
    [-1,1,-1],[1,1,-1], [1,1,-1],[1,1,1], [1,1,1],[-1,1,1], [-1,1,1],[-1,1,-1],
    // verticals
    [-1,-1,-1],[-1,1,-1], [1,-1,-1],[1,1,-1], [1,-1,1],[1,1,1], [-1,-1,1],[-1,1,1],
  ];

  for (let i = 0; i < edgeCount; i++) {
    const eIdx = Math.floor(r() * (edges.length / 2)) * 2;
    const a = edges[eIdx], b = edges[eIdx+1];
    const t = r();
    out[(vertCount+i)*3]   = (a[0] + (b[0]-a[0])*t)*S + (r()-0.5)*0.025;
    out[(vertCount+i)*3+1] = (a[1] + (b[1]-a[1])*t)*S + (r()-0.5)*0.025;
    out[(vertCount+i)*3+2] = (a[2] + (b[2]-a[2])*t)*S + (r()-0.5)*0.025;
  }

  // Face centers with slight noise
  const faces = [
    [0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]
  ];
  for (let i = 0; i < faceCount; i++) {
    const f = faces[Math.floor(r() * faces.length)];
    const u = (r()-0.5)*2, v = (r()-0.5)*2;
    let x = f[0] !== 0 ? f[0]*S + (r()-0.5)*0.04 : u*S;
    let y = f[1] !== 0 ? f[1]*S + (r()-0.5)*0.04 : (f[0]===0 ? u*S : v*S);
    let z = f[2] !== 0 ? f[2]*S + (r()-0.5)*0.04 : v*S;
    out[(vertCount+edgeCount+i)*3]   = x;
    out[(vertCount+edgeCount+i)*3+1] = y;
    out[(vertCount+edgeCount+i)*3+2] = z;
  }

  return normalizeArray(out);
}

/* ── Heart shape ─────────────────────────────────────────── */
export function makeHeartShape(count) {
  const out = new Float32Array(count * 3);
  const r = rng(99);

  for (let i = 0; i < count; i++) {
    let x, y, z;
    // Heart curve parametric + thickness
    const t = r() * TWO_PI;
    const scale = 1.0;
    // Classic heart: x=16sin³t, y=13cos t-5cos2t-2cos3t-cos4t
    x = 16 * Math.pow(Math.sin(t), 3) / 16 * scale;
    y = (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)) / 13 * scale;
    z = (r()-0.5) * 0.18;

    // Add volume: some particles fill the interior
    if (r() < 0.4) {
      const fillT = r() * TWO_PI;
      const fillR = Math.sqrt(r());
      x = 16 * Math.pow(Math.sin(fillT), 3) / 16 * scale * fillR;
      y = ((13*Math.cos(fillT) - 5*Math.cos(2*fillT) - 2*Math.cos(3*fillT) - Math.cos(4*fillT)) / 13 * scale) * fillR;
      z = (r()-0.5) * 0.12;
    }

    out[i*3]   = x + (r()-0.5)*0.04;
    out[i*3+1] = y + (r()-0.5)*0.04;
    out[i*3+2] = z;
  }

  return normalizeArray(out);
}

/* ── Scatter shape (identity / free positions) ───────────── */
// Returns zeroed array — the vertex shader handles scatter via uScatter uniform
export function makeScatterShape(count) {
  return new Float32Array(count * 3); // all zeros; shader handles it
}