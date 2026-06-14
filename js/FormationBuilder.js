// ============================================
// FORMATION BUILDER
// Menghasilkan array posisi target (x,y,z)
// untuk setiap formasi partikel.
// ============================================

export class FormationBuilder {

  // ─── Text "By Arif" ──────────────────────
  static buildTextFormation(count) {
    // Bitmap sederhana untuk setiap huruf
    // Setiap huruf didefinisikan sebagai grid 5×7 piksel (1 = ada titik)
    const letters = {
      B: [
        [1,1,0],[1,0,1],[1,0,1],[1,1,0],
        [1,0,1],[1,0,1],[1,1,0]
      ],
      y: [
        [1,0,1],[1,0,1],[0,1,1],[0,0,1],[0,1,0]
      ],
      ' ': [],
      A: [
        [0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]
      ],
      r: [
        [1,1,0],[1,0,1],[1,0,0],[1,0,0],[1,0,0]
      ],
      i: [[1],[0],[1],[1],[1]],
      f: [
        [0,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]
      ]
    };

    // Rasterisasi teks ke array koordinat
    const rawPoints = [];
    const text = ['B','y',' ','A','r','i','f'];
    let cursorX = 0;

    for (const ch of text) {
      if (ch === ' ') { cursorX += 2; continue; }
      const pattern = letters[ch] || [];
      for (let row = 0; row < pattern.length; row++) {
        const cols = pattern[row];
        for (let col = 0; col < cols.length; col++) {
          if (cols[col]) {
            rawPoints.push([cursorX + col, -row, 0]);
          }
        }
      }
      const maxCol = pattern[0] ? pattern[0].length : 2;
      cursorX += maxCol + 1;
    }

    return FormationBuilder._distributePoints(rawPoints, count, 0.6);
  }

  // ─── Saturn ──────────────────────────────
  static buildSaturnFormation(count) {
    const points = [];
    const bodyCount  = Math.floor(count * 0.45);
    const ringCount  = Math.floor(count * 0.45);
    const cloudCount = count - bodyCount - ringCount;

    // Bola planet
    for (let i = 0; i < bodyCount; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 1.8 + Math.random() * 0.15;
      points.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta) * 0.5
      ]);
    }

    // Cincin elips (ring tilted ~27°)
    for (let i = 0; i < ringCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const rInner = 2.4, rOuter = 4.2;
      const r     = rInner + Math.random() * (rOuter - rInner);
      const tilt  = 0.3; // rad ≈ 17°
      const x     = r * Math.cos(theta);
      const zBase = r * Math.sin(theta) * 0.12; // pipih
      points.push([
        x,
        zBase * Math.cos(tilt) + (Math.random() - 0.5) * 0.08,
        r * Math.sin(theta)
      ]);
    }

    // Awan atmosfer tipis
    for (let i = 0; i < cloudCount; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 1.95 + Math.random() * 0.2;
      points.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.9,
        r * Math.sin(phi) * Math.sin(theta) * 0.5
      ]);
    }

    return FormationBuilder._rawToScaled(points, count, 1.4);
  }

  // ─── Cube 3D ─────────────────────────────
  static buildCubeFormation(count) {
    const points = [];
    const edgeCount  = Math.floor(count * 0.55);
    const faceCount  = count - edgeCount;
    const half = 2.2;

    // 12 edge kubus
    const edges = [
      // bottom face
      [[-1,-1,-1],[1,-1,-1]],[[1,-1,-1],[1,-1,1]],
      [[1,-1,1],[-1,-1,1]],[[-1,-1,1],[-1,-1,-1]],
      // top face
      [[-1,1,-1],[1,1,-1]],[[1,1,-1],[1,1,1]],
      [[1,1,1],[-1,1,1]],[[-1,1,1],[-1,1,-1]],
      // vertical edges
      [[-1,-1,-1],[-1,1,-1]],[[1,-1,-1],[1,1,-1]],
      [[1,-1,1],[1,1,1]],[[-1,-1,1],[-1,1,1]]
    ];

    const perEdge = Math.floor(edgeCount / edges.length);
    for (const [a, b] of edges) {
      for (let i = 0; i < perEdge; i++) {
        const t = i / perEdge;
        points.push([
          (a[0] + (b[0]-a[0])*t) * half + (Math.random()-0.5)*0.04,
          (a[1] + (b[1]-a[1])*t) * half + (Math.random()-0.5)*0.04,
          (a[2] + (b[2]-a[2])*t) * half + (Math.random()-0.5)*0.04
        ]);
      }
    }

    // Face particles (tersebar di 6 sisi)
    const faces = [
      [0,2,1],[0,2,-1],[1,0,2],[1,0,-2],[2,1,0],[2,1,0] // placeholder
    ];
    const faceNormals = [
      [0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]
    ];
    const perFace = Math.floor(faceCount / 6);
    for (let f = 0; f < 6; f++) {
      const n = faceNormals[f];
      for (let i = 0; i < perFace; i++) {
        const u = (Math.random() - 0.5) * 2 * half;
        const v = (Math.random() - 0.5) * 2 * half;
        let px, py, pz;
        if (n[2] !== 0) { px=u; py=v; pz=n[2]*half; }
        else if (n[0] !== 0) { px=n[0]*half; py=u; pz=v; }
        else { px=u; py=n[1]*half; pz=v; }
        points.push([px, py, pz]);
      }
    }

    return FormationBuilder._rawToScaled(points, count, 1.0);
  }

  // ─── Heart ───────────────────────────────
  static buildHeartFormation(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      // Parametrik heart kurva
      const t = (i / count) * Math.PI * 2;
      // Isi area hati dengan random sampling
      const scale = Math.random();
      const x =  scale * 16 * Math.pow(Math.sin(t), 3);
      const y =  scale * (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t));
      const z = (Math.random() - 0.5) * 0.5;
      points.push([x * 0.15, y * 0.15, z]);
    }
    return FormationBuilder._rawToScaled(points, count, 1.1);
  }

  // ─── Scatter (5 jari) ────────────────────
  static buildScatterFormation(count, spread = 14) {
    const points = [];
    for (let i = 0; i < count; i++) {
      // Ledakan ke semua arah
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = spread * (0.4 + Math.random() * 0.6);
      points.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      ]);
    }
    return points;
  }

  // ─── Float bebas (idle) ──────────────────
  static buildFloatFormation(count, spread = 10) {
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push([
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 1.2,
        (Math.random() - 0.5) * spread * 0.8
      ]);
    }
    return points;
  }

  // ─── Helpers ─────────────────────────────

  /**
   * Distribusi titik dari rawPoints ke jumlah count
   * dengan pengulangan jika perlu.
   */
  static _distributePoints(rawPoints, count, scale = 1) {
    const out = [];
    if (rawPoints.length === 0) return FormationBuilder.buildFloatFormation(count);
    for (let i = 0; i < count; i++) {
      const src = rawPoints[i % rawPoints.length];
      out.push([src[0] * scale, src[1] * scale, src[2] * scale]);
    }
    // Hitung centroid dan center-kan
    const cx = out.reduce((s,p)=>s+p[0],0)/out.length;
    const cy = out.reduce((s,p)=>s+p[1],0)/out.length;
    return out.map(p => [p[0]-cx, p[1]-cy, p[2]]);
  }

  static _rawToScaled(points, count, scale = 1) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const src = points[i % points.length];
      out.push([src[0]*scale, src[1]*scale, src[2]*scale]);
    }
    return out;
  }
}
