export type Piece = {
  x: number;
  z: number;
  len: number;
  wid: number;
  rot: number;
  order: number;
  shade: number;
  shift: number;
  shape: "box" | "chevron" | "hex";
  flip: number;
};

function hash(n: number) {
  const t = 43758.5453 * Math.sin(127.1 * n + 311.7);
  return t - Math.floor(t);
}

function hash2(n: number) {
  const t = 43758.5453 * Math.sin(127.1 * n + 19.2);
  return t - Math.floor(t);
}

function shadeOf(x: number, z: number, salt: number) {
  return {
    shade: 0.82 + 0.28 * hash(12.3 * x + 4.7 * z + salt),
    shift: hash(2.1 * x + 9.9 * z + salt + 19),
  };
}

function rank(pieces: Piece[]) {
  if (!pieces.length) return;
  let min = Infinity;
  let max = -Infinity;
  for (const p of pieces) {
    min = Math.min(min, p.z);
    max = Math.max(max, p.z);
  }
  const span = Math.max(1e-4, max - min);
  for (const p of pieces) p.order = Math.round(((p.z - min) / span) * 14) / 14;
}

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e;
    return ((e ^ (e >>> 14)) >>> 0) / 0x100000000;
  };
}

export function feetToMeters(ft: number) {
  const n = Number.isFinite(ft) ? ft : 12;
  return Math.min(40, Math.max(6, n)) * 0.3048;
}

/** World-space slab size: 1 foot = 0.3048 m. Board and tile sizes stay fixed; a bigger room adds more pieces. */
export function roomSpans(lengthFt = 18, widthFt = 14) {
  const L = Math.min(40, Math.max(6, Number.isFinite(lengthFt) ? lengthFt : 18));
  const W = Math.min(40, Math.max(6, Number.isFinite(widthFt) ? widthFt : 14));
  return { spanX: L * 0.3048, spanZ: W * 0.3048 };
}

export function patchSpans(lengthFt = 18, widthFt = 14) {
  return roomSpans(lengthFt, widthFt);
}

export function layoutHerringbone(spanX = 1.22, spanZ = 1.22, width = 0.0762, ratio = 4, gap = 0.002) {
  const n = ratio;
  const cycle = 2 * n;
  const out: Piece[] = [];
  const seen = new Set<string>();
  const loC = Math.floor(-spanX / 2 / width) - n - 2;
  const hiC = Math.ceil(spanX / 2 / width) + n + 2;
  const loR = Math.floor(-spanZ / 2 / width) - n - 2;
  const hiR = Math.ceil(spanZ / 2 / width) + n + 2;
  const length = n * width;
  for (let row = loR; row <= hiR; row++) {
    for (let col = loC; col <= hiC; col++) {
      const u = ((col - row) % cycle + cycle) % cycle;
      let ox: number;
      let oz: number;
      let horiz: boolean;
      if (u < n) {
        ox = col - u;
        oz = row;
        horiz = true;
      } else {
        ox = col;
        oz = row - (cycle - 1 - u);
        horiz = false;
      }
      const key = `${horiz ? "H" : "V"}:${ox},${oz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (horiz) {
        const x = (ox + n / 2) * width;
        const z = (oz + 0.5) * width;
        const s = shadeOf(x, z, 11);
        out.push({ x, z, len: length - gap, wid: width - gap, rot: 0, order: 0, shape: "box", flip: 1, ...s });
      } else {
        const x = (ox + 0.5) * width;
        const z = (oz + n / 2) * width;
        const s = shadeOf(x, z, 12);
        out.push({ x, z, len: length - gap, wid: width - gap, rot: Math.PI / 2, order: 0, shape: "box", flip: 1, ...s });
      }
    }
  }
  rank(out);
  return out;
}

export function layoutGrid(spanX: number, spanZ: number, stepX: number, stepZ: number, len: number, wid: number, shape: Piece["shape"] = "box", rot = 0) {
  const out: Piece[] = [];
  const c0 = Math.floor(-spanX / 2 / stepX) - 1;
  const c1 = Math.ceil(spanX / 2 / stepX) + 1;
  const r0 = Math.floor(-spanZ / 2 / stepZ) - 1;
  const r1 = Math.ceil(spanZ / 2 / stepZ) + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = (c + 0.5) * stepX;
      const z = (r + 0.5) * stepZ;
      const m = hash2(9 * x + 3 * z + r);
      out.push({
        x,
        z,
        len,
        wid,
        rot,
        order: 0,
        shade: 0.86 + 0.22 * m,
        shift: hash2(2 * x + 5 * z),
        shape,
        flip: 1,
      });
    }
  }
  rank(out);
  return out;
}

export function layoutStraight(spanX = 1.22, spanZ = 1.22, width = 0.1524, gap = 0.0024) {
  const out: Piece[] = [];
  const minLen = Math.max(0.42, 5 * width);
  const maxLen = Math.max(minLen + 0.25, 1.55);
  const row0 = Math.floor((-spanZ / 2) / width) - 1;
  const row1 = Math.ceil((spanZ / 2) / width) + 1;
  for (let row = row0; row <= row1; row++) {
    const z = row * width;
    const rnd = mulberry((10007 + 97 * row + Math.round(1e4 * width)) >>> 0);
    let x = -spanX / 2 - rnd() * Math.min(0.7, maxLen);
    let guard = 0;
    while (x < spanX / 2 + 0.08 && guard++ < 800) {
      const length = minLen + rnd() * (maxLen - minLen);
      const cx = x + length / 2;
      if (cx + length / 2 >= -spanX / 2 - 0.08 && cx - length / 2 <= spanX / 2 + 0.08) {
        const s = shadeOf(cx, z, row + 3);
        out.push({
          x: cx,
          z,
          len: Math.max(0.05, length - gap),
          wid: Math.max(0.01, width - gap),
          rot: 0,
          order: 0,
          shape: "box",
          flip: 1,
          ...s,
        });
      }
      x += length;
    }
  }
  rank(out);
  return out;
}

export function layoutChevron(spanX = 1.22, spanZ = 1.22, width = 0.076) {
  const length = 0.4;
  const r = length / Math.SQRT2;
  const stride = 2 * r - 0.0015;
  const step = width * Math.SQRT2 - 0.0015;
  const out: Piece[] = [];
  const col0 = Math.floor((-spanX / 2 - r) / stride) - 1;
  const col1 = Math.ceil((spanX / 2 + r) / stride) + 1;
  const row0 = Math.floor(-spanZ / 2 / step) - 1;
  const row1 = Math.ceil(spanZ / 2 / step) + 1;
  for (let c = col0; c <= col1; c++) {
    const t = c * stride;
    for (let row = row0; row <= row1; row++) {
      const z = row * step;
      for (const dir of [1, -1] as const) {
        const x = t + (dir * r) / 2;
        const s = shadeOf(x, z, 21 + dir);
        out.push({ x, z, len: length, wid: width, rot: 0, order: 0, shape: "chevron", flip: dir, ...s });
      }
    }
  }
  rank(out);
  return out;
}

export function layoutHex(spanX = 1.22, spanZ = 1.22) {
  const rowH = 0.016 * Math.sqrt(3);
  const zStep = 0.024;
  const out: Piece[] = [];
  const row0 = Math.floor((-spanZ / 2 - 0.03) / zStep) - 1;
  const row1 = Math.ceil((spanZ / 2 + 0.03) / zStep) + 1;
  const col0 = Math.floor((-spanX / 2 - rowH) / rowH) - 1;
  const col1 = Math.ceil((spanX / 2 + rowH) / rowH) + 1;
  for (let row = row0; row <= row1; row++) {
    const z = row * zStep;
    const off = ((row % 2) + 2) % 2 ? rowH / 2 : 0;
    for (let col = col0; col <= col1; col++) {
      const x = col * rowH + off;
      const m = hash2(4 * x + z);
      out.push({
        x,
        z,
        len: 0.032,
        wid: 0.032,
        rot: 0,
        order: 0,
        shade: 0.86 + 0.22 * m,
        shift: hash2(3 * z + x),
        shape: "hex",
        flip: 1,
      });
    }
  }
  rank(out);
  return out;
}

export function layoutOffset(spanX: number, spanZ: number, stepX: number, stepZ: number, len: number, wid: number, frac = 0.5) {
  const out: Piece[] = [];
  const c0 = Math.floor(-spanX / 2 / stepX) - 2;
  const c1 = Math.ceil(spanX / 2 / stepX) + 2;
  const r0 = Math.floor(-spanZ / 2 / stepZ) - 1;
  const r1 = Math.ceil(spanZ / 2 / stepZ) + 1;
  const shift = ((frac % 1) + 1) % 1;
  for (let r = r0; r <= r1; r++) {
    const off = (((r % 2) + 2) % 2) * shift * stepX;
    for (let c = c0; c <= c1; c++) {
      const x = (c + 0.5) * stepX + off;
      const z = (r + 0.5) * stepZ;
      const m = hash2(9 * x + 3 * z + r);
      out.push({
        x,
        z,
        len,
        wid,
        rot: 0,
        order: 0,
        shade: 0.86 + 0.22 * m,
        shift: hash2(2 * x + 5 * z),
        shape: "box",
        flip: 1,
      });
    }
  }
  rank(out);
  return out;
}

export function layoutChecker(spanX: number, spanZ: number, step: number, tile: number) {
  const out: Piece[] = [];
  const c0 = Math.floor(-spanX / 2 / step) - 1;
  const c1 = Math.ceil(spanX / 2 / step) + 1;
  const r0 = Math.floor(-spanZ / 2 / step) - 1;
  const r1 = Math.ceil(spanZ / 2 / step) + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = (c + 0.5) * step;
      const z = (r + 0.5) * step;
      const dark = ((c + r) & 1) === 1;
      out.push({
        x,
        z,
        len: tile,
        wid: tile,
        rot: 0,
        order: 0,
        shade: dark ? 0.05 : 0.95,
        shift: hash2(2 * x + 5 * z),
        shape: "box",
        flip: dark ? -1 : 1,
      });
    }
  }
  rank(out);
  return out;
}

export function piecesFor(state: {
  job: string;
  family: string;
  pattern: string;
  tileStyle: string;
  lengthFt?: number;
  widthFt?: number;
  groutWidth?: string;
  sampleLengthFt?: number;
  sampleWidthFt?: number;
}) {
  const { spanX, spanZ } = patchSpans(state.lengthFt ?? state.sampleLengthFt ?? 18, state.widthFt ?? state.sampleWidthFt ?? 14);
  const gaps: Record<string, number> = { tight: 0.0016, standard: 0.0032, wide: 0.0064 };
  const gap = gaps[state.groutWidth ?? "standard"] ?? 0.0032;
  if (state.job === "new" && state.family === "tile") {
    const id = state.tileStyle;
    if (id === "hex") return layoutHex(spanX, spanZ);
    if (id === "square-mosaic" || id === "square") return layoutGrid(spanX, spanZ, 0.0254 + gap, 0.0254 + gap, 0.0254, 0.0254);
    if (id === "herringbone-tile" || id === "marble-herringbone") return layoutHerringbone(spanX, spanZ, 0.0508, 3, Math.max(0.0012, gap * 0.7));
    if (id === "chevron-tile") return layoutChevron(spanX, spanZ, 0.05);
    if (id === "checkerboard") return layoutChecker(spanX, spanZ, 0.3048 + gap, 0.3048);
    if (id === "porcelain-24") return layoutGrid(spanX, spanZ, 0.6096 + gap, 0.6096 + gap, 0.6096, 0.6096);
    if (id === "porcelain-12x24") return layoutGrid(spanX, spanZ, 0.6096 + gap, 0.3048 + gap, 0.6096, 0.3048);
    if (id === "porcelain-12x24-offset") return layoutOffset(spanX, spanZ, 0.6096 + gap, 0.3048 + gap, 0.6096, 0.3048, 1 / 3);
    if (id === "wood-look") return layoutOffset(spanX, spanZ, 1.016 + gap, 0.1778 + gap, 1.016, 0.1778, 0.35);
    if (id === "subway") return layoutOffset(spanX, spanZ, 0.1524 + gap, 0.0762 + gap, 0.1524, 0.0762, 0.5);
    if (id === "slate") return layoutGrid(spanX, spanZ, 0.4064 + gap, 0.4064 + gap, 0.4064, 0.4064);
    if (id === "terracotta") return layoutGrid(spanX, spanZ, 0.3048 + gap, 0.3048 + gap, 0.3048, 0.3048);
    if (id === "calacatta" || id === "carrara" || id === "large-marble") return layoutGrid(spanX, spanZ, 0.6096 + gap, 0.3048 + gap, 0.6096, 0.3048);
    return layoutGrid(spanX, spanZ, 0.6096 + gap, 0.3048 + gap, 0.6096, 0.3048);
  }
  if (state.pattern === "herringbone") return layoutHerringbone(spanX, spanZ, 0.0762, 4, 0.0022);
  if (state.pattern === "chevron") return layoutChevron(spanX, spanZ, 0.076);
  return layoutStraight(spanX, spanZ, 0.1524, 0.0026);
}
