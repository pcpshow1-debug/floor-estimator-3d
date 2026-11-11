import { roomProfile, visualFeet, type RoomId } from "@/config/rooms";
import { stairWellFromFeet } from "@/config/stairs";

export const MAX_WINS = 5;
export const DOOR_W = 0.9;
export const DOOR_H = 2.08;
export const WALL_INSET = 0.07;

export type Wall = "back" | "left";

export type Opening = {
  id: string;
  wall: Wall;
  min: number;
  max: number;
  y0: number;
  y1: number;
};

export type LayoutBox = {
  id: string;
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
  rotY?: number;
  mount?: Wall;
  group?: string;
  kind: "wall" | "floor";
};

export function windowCenters(wallLen: number, winW: number, minN: number, maxN: number) {
  const gap = 0.38;
  const usable = Math.max(winW, wallLen - 1.2);
  const n = Math.max(minN, Math.min(maxN, MAX_WINS, Math.floor((usable + gap) / (winW + gap)) || minN));
  if (n <= 0) return [] as number[];
  const total = n * winW + Math.max(0, n - 1) * gap;
  const start = -total / 2 + winW / 2;
  return Array.from({ length: n }, (_, i) => start + i * (winW + gap));
}

export function roomSpans(kind: RoomId, lengthFt: number, widthFt: number) {
  if (kind === "stairs") {
    const well = stairWellFromFeet(lengthFt, widthFt);
    return { spanX: well.hallW, spanZ: well.hallL };
  }
  const vis = visualFeet(kind, lengthFt, widthFt);
  return { spanX: vis.length * 0.3048, spanZ: vis.width * 0.3048 };
}

export function roomOpenings(kind: RoomId, spanX: number, spanZ: number): Opening[] {
  const p = roomProfile(kind);
  const hx = spanX / 2;
  const hz = spanZ / 2;
  const xs = windowCenters(spanX, p.winW, p.minWindows, p.maxWindows);
  const list: Opening[] = xs.map((x, i) => ({
    id: `window-${i}`,
    wall: "back" as const,
    min: x - p.winW / 2,
    max: x + p.winW / 2,
    y0: p.sill,
    y1: p.sill + p.winH,
  }));
  if (p.leftCover >= 0.8) {
    const doorZ = hz - 0.58;
    list.push({
      id: "door",
      wall: "left",
      min: doorZ - DOOR_W / 2,
      max: doorZ + DOOR_W / 2,
      y0: 0,
      y1: DOOR_H,
    });
  }
  return list;
}

function segmentsOnLine(lo: number, hi: number, blocked: { min: number; max: number }[], pad: number) {
  const cuts = blocked
    .map((b) => ({ min: b.min - pad, max: b.max + pad }))
    .sort((a, b) => a.min - b.min);
  const segs: { min: number; max: number }[] = [];
  let cursor = lo;
  for (const c of cuts) {
    if (c.min > cursor) segs.push({ min: cursor, max: c.min });
    cursor = Math.max(cursor, c.max);
  }
  if (hi > cursor) segs.push({ min: cursor, max: hi });
  return segs;
}

export function placeOnWall(
  kind: RoomId,
  spanX: number,
  spanZ: number,
  wall: Wall,
  half: number,
  prefer: "start" | "end" | "widest" | "pack-start" | "pack-end" = "widest",
) {
  const fitted = placeFittedOnWall(kind, spanX, spanZ, wall, half, prefer);
  return fitted ? fitted.pos : null;
}

export function placeFittedOnWall(
  kind: RoomId,
  spanX: number,
  spanZ: number,
  wall: Wall,
  half: number,
  prefer: "start" | "end" | "widest" | "pack-start" | "pack-end" = "widest",
) {
  const openings = roomOpenings(kind, spanX, spanZ).filter((o) => o.wall === wall);
  const lo = wall === "back" ? -spanX / 2 + 0.08 : -spanZ / 2 + 0.08;
  const hi = wall === "back" ? spanX / 2 - 0.08 : spanZ / 2 - 0.08;
  const curtainPad = wall === "back" && roomProfile(kind).curtains ? 0.26 : 0;
  const raw = segmentsOnLine(lo, hi, openings, 0.06 + curtainPad);
  if (!raw.length) return null;
  const fitting = raw.filter((seg) => seg.max - seg.min >= half * 2);
  const pick = (fitting.length ? fitting : raw)[
    prefer === "start" || prefer === "pack-start" ? 0 : prefer === "end" || prefer === "pack-end" ? (fitting.length ? fitting : raw).length - 1 : 0
  ];
  const chosen = prefer === "widest" ? (fitting.length ? fitting : raw).reduce((a, b) => (b.max - b.min > a.max - a.min ? b : a)) : pick;
  const usedHalf = Math.min(half, Math.max(0, (chosen.max - chosen.min) / 2 - 0.015));
  if (usedHalf < 0.16) return null;
  const pos =
    prefer === "pack-start" ? chosen.min + usedHalf : prefer === "pack-end" ? chosen.max - usedHalf : (chosen.min + chosen.max) / 2;
  return { pos, half: usedHalf };
}

function box(partial: LayoutBox): LayoutBox {
  return partial;
}

export function layoutBoxes(kind: RoomId, spanX: number, spanZ: number): LayoutBox[] {
  const hx = spanX / 2;
  const hz = spanZ / 2;
  const profile = roomProfile(kind);
  const items: LayoutBox[] = [];

  if (kind === "living") {
    const artFit = placeFittedOnWall(kind, spanX, spanZ, "back", 0.38, "start");
    const fireZ = placeOnWall(kind, spanX, spanZ, "left", 0.74, "start") ?? -0.15;
    if (artFit) {
      items.push(box({ id: "living-art", x: artFit.pos, y: 1.7, z: -hz + 0.05, hx: artFit.half, hy: 0.28, hz: 0.04, mount: "back", kind: "wall" }));
    } else {
      const below = Math.min(1.05, profile.sill - 0.34);
      items.push(box({ id: "living-art", x: -hx * 0.55, y: below, z: -hz + 0.05, hx: 0.28, hy: 0.24, hz: 0.04, mount: "back", kind: "wall" }));
    }
    items.push(
      box({ id: "living-fireplace", x: -hx + 0.18, y: 1.02, z: fireZ, hx: 0.16, hy: 1.02, hz: 0.74, rotY: Math.PI / 2, mount: "left", kind: "wall" }),
      box({ id: "living-sofa", x: 0.02, y: 0.4, z: -hz + 1.14, hx: 1.1, hy: 0.42, hz: 0.44, group: "living-seat", kind: "floor" }),
      box({ id: "living-chaise", x: 1.28, y: 0.4, z: -hz + 1.74, hx: 0.48, hy: 0.42, hz: 0.72, rotY: -Math.PI / 2, group: "living-seat", kind: "floor" }),
      box({ id: "living-coffee", x: 0.1, y: 0.2, z: -hz + 2.24, hx: 0.56, hy: 0.2, hz: 0.3, kind: "floor" }),
      box({ id: "living-side", x: -1.24, y: 0.24, z: -hz + 1.16, hx: 0.24, hy: 0.26, hz: 0.24, group: "living-seat", kind: "floor" }),
      box({ id: "living-lamp", x: -1.4, y: 0.8, z: -hz + 1.16, hx: 0.16, hy: 0.8, hz: 0.16, group: "living-seat", kind: "floor" }),
      box({ id: "living-plant", x: hx - 0.42, y: 0.4, z: hz - 0.48, hx: 0.2, hy: 0.45, hz: 0.2, kind: "floor" }),
    );
    if (spanX >= 5.2) {
      items.push(box({ id: "living-chair", x: Math.min(hx - 0.82, 1.78), y: 0.4, z: Math.min(0.52, hz - 1.15), hx: 0.42, hy: 0.4, hz: 0.4, kind: "floor" }));
    }
  }

  const clampX = (x: number, half: number) => Math.max(-hx + half + 0.06, Math.min(hx - half - 0.06, x));
  if (kind === "kitchen") {
    const z = -hz + 0.4;
    items.push(
      box({ id: "kit-cab", x: clampX(-1.15, 0.38), y: 0.45, z, hx: 0.38, hy: 0.45, hz: 0.32, group: "kitchen-run", kind: "floor" }),
      box({ id: "kit-sink", x: clampX(-0.35, 0.38), y: 0.45, z, hx: 0.38, hy: 0.45, hz: 0.32, group: "kitchen-run", kind: "floor" }),
      box({ id: "kit-stove", x: clampX(0.45, 0.38), y: 0.45, z, hx: 0.38, hy: 0.45, hz: 0.32, group: "kitchen-run", kind: "floor" }),
      box({ id: "kit-fridge", x: clampX(1.35, 0.38), y: 0.85, z: -hz + 0.42, hx: 0.38, hy: 0.85, hz: 0.34, group: "kitchen-run", kind: "floor" }),
      box({ id: "kit-island", x: 0.05, y: 0.4, z: 0.15, hx: 0.42, hy: 0.4, hz: 0.32, kind: "floor" }),
      box({ id: "kit-stool-a", x: -0.35, y: 0.35, z: 0.72, hx: 0.18, hy: 0.35, hz: 0.18, kind: "floor" }),
      box({ id: "kit-stool-b", x: 0.4, y: 0.35, z: 0.72, hx: 0.18, hy: 0.35, hz: 0.18, kind: "floor" }),
      box({ id: "kit-plant", x: hx - 0.4, y: 0.4, z: hz - 0.45, hx: 0.18, hy: 0.4, hz: 0.18, kind: "floor" }),
    );
  }

  if (kind === "dining") {
    items.push(
      box({ id: "din-table", x: 0, y: 0.4, z: 0.05, hx: 0.85, hy: 0.4, hz: 0.48, group: "dining-set", kind: "floor" }),
      box({ id: "din-c1", x: -0.82, y: 0.4, z: -0.95, hx: 0.24, hy: 0.4, hz: 0.24, group: "dining-set", kind: "floor" }),
      box({ id: "din-c2", x: 0.82, y: 0.4, z: -0.95, hx: 0.24, hy: 0.4, hz: 0.24, group: "dining-set", kind: "floor" }),
      box({ id: "din-c3", x: -0.82, y: 0.4, z: 0.95, hx: 0.24, hy: 0.4, hz: 0.24, group: "dining-set", kind: "floor" }),
      box({ id: "din-c4", x: 0.82, y: 0.4, z: 0.95, hx: 0.24, hy: 0.4, hz: 0.24, group: "dining-set", kind: "floor" }),
      box({ id: "din-console", x: 0, y: 0.4, z: -hz + 0.32, hx: 0.5, hy: 0.4, hz: 0.22, kind: "floor" }),
      box({ id: "din-plant", x: hx - 0.4, y: 0.4, z: hz - 0.45, hx: 0.18, hy: 0.4, hz: 0.18, kind: "floor" }),
    );
  }

  if (kind === "bedroom") {
    const accH = Math.max(0.55, Math.min(0.82, profile.sill - 0.12));
    const accHalf = Math.min((spanX >= 4.4 ? 1.92 : 1.52) + 0.25, spanX * 0.32) / 2;
    const accX = placeOnWall(kind, spanX, spanZ, "back", accHalf, "widest") ?? 0;
    items.push(
      box({ id: "bed-accent", x: accX, y: accH / 2, z: -hz + 0.03, hx: accHalf, hy: accH / 2, hz: 0.03, mount: "back", kind: "wall" }),
      box({ id: "bed", x: 0, y: 0.4, z: -hz + 1.15, hx: 0.85, hy: 0.4, hz: 1.05, group: "bed-group", kind: "floor" }),
      box({ id: "bed-n1", x: -1.15, y: 0.3, z: -hz + 0.55, hx: 0.28, hy: 0.3, hz: 0.22, group: "bed-group", kind: "floor" }),
      box({ id: "bed-n2", x: 1.15, y: 0.3, z: -hz + 0.55, hx: 0.28, hy: 0.3, hz: 0.22, group: "bed-group", kind: "floor" }),
      box({ id: "bed-plant", x: -hx + 0.35, y: 0.4, z: hz - 0.42, hx: 0.18, hy: 0.4, hz: 0.18, kind: "floor" }),
    );
    if (spanX >= 3.6) {
      items.push(box({ id: "bed-case", x: hx - 0.35, y: 0.7, z: 0.2, hx: 0.2, hy: 0.7, hz: 0.45, rotY: -Math.PI / 2, kind: "floor" }));
    }
  }

  if (kind === "bathroom") {
    const vanityX = placeOnWall(kind, spanX, spanZ, "back", 0.32, "start") ?? -hx + 0.5;
    const vanityTop = 0.76;
    const mirrorHy = 0.34;
    const mirrorY = vanityTop + 0.15 + mirrorHy;
    const doorMin = hz - 0.58 - DOOR_W / 2;
    const leftHi = Math.min(hz - 0.12, doorMin - 0.04);
    const toiletZ = Math.min(leftHi - 0.18, Math.max(-hz + 0.62, doorMin - 0.24));
    const towelZ = Math.min(doorMin - 0.22, Math.max(-hz + 0.78, toiletZ + 0.4));
    const showerX = hx - 0.46;
    items.push(
      box({ id: "bath-vanity", x: vanityX, y: 0.38, z: -hz + 0.22, hx: 0.38, hy: 0.38, hz: 0.2, group: "vanity", kind: "floor" }),
      box({ id: "bath-mirror", x: vanityX, y: mirrorY, z: -hz + 0.06, hx: 0.3, hy: mirrorHy, hz: 0.04, mount: "back", kind: "wall" }),
      box({ id: "bath-toilet", x: -hx + 0.32, y: 0.35, z: toiletZ, hx: 0.2, hy: 0.35, hz: 0.17, kind: "floor" }),
      box({ id: "bath-shower", x: showerX, y: 0.9, z: -hz + 0.46, hx: 0.42, hy: 0.9, hz: 0.42, group: "wet", kind: "floor" }),
      box({ id: "bath-towel-a", x: -hx + 0.08, y: 0.9, z: towelZ - 0.11, hx: 0.05, hy: 0.38, hz: 0.12, rotY: Math.PI / 2, mount: "left", group: "towels", kind: "wall" }),
      box({ id: "bath-towel-b", x: -hx + 0.08, y: 0.9, z: towelZ + 0.11, hx: 0.05, hy: 0.38, hz: 0.12, rotY: Math.PI / 2, mount: "left", group: "towels", kind: "wall" }),
    );
  }

  if (kind === "entry") {
    const rackZ = placeOnWall(kind, spanX, spanZ, "left", 0.22, "start") ?? -hz + 0.7;
    items.push(
      box({ id: "entry-console", x: 0, y: 0.4, z: -hz + 0.3, hx: 0.48, hy: 0.4, hz: 0.2, kind: "floor" }),
      box({ id: "entry-bench", x: -hx + 0.42, y: 0.3, z: 0.15, hx: 0.42, hy: 0.3, hz: 0.22, kind: "floor" }),
      box({ id: "entry-coatrack", x: -hx + 0.12, y: 1.15, z: rackZ, hx: 0.08, hy: 0.55, hz: 0.22, rotY: Math.PI / 2, mount: "left", kind: "wall" }),
      box({ id: "entry-stand", x: hx - 0.32, y: 0.8, z: -0.2, hx: 0.16, hy: 0.8, hz: 0.16, kind: "floor" }),
      box({ id: "entry-shoes", x: -hx + 0.55, y: 0.06, z: 0.55, hx: 0.18, hy: 0.06, hz: 0.16, kind: "floor" }),
      box({ id: "entry-plant", x: hx - 0.38, y: 0.4, z: hz - 0.4, hx: 0.18, hy: 0.4, hz: 0.18, kind: "floor" }),
    );
  }

  if (kind === "office") {
    const caseZ = placeOnWall(kind, spanX, spanZ, "left", 0.42, "start") ?? -0.2;
    items.push(
      box({ id: "off-desk", x: 0.1, y: 0.4, z: -hz + 0.55, hx: 0.7, hy: 0.4, hz: 0.35, group: "desk", kind: "floor" }),
      box({ id: "off-chair", x: 0.1, y: 0.4, z: -hz + 1.15, hx: 0.28, hy: 0.4, hz: 0.28, group: "desk", kind: "floor" }),
      box({ id: "off-case", x: -hx + 0.22, y: 0.75, z: caseZ, hx: 0.16, hy: 0.75, hz: 0.42, rotY: Math.PI / 2, mount: "left", kind: "wall" }),
      box({ id: "off-lamp", x: hx - 0.35, y: 0.8, z: -hz + 0.35, hx: 0.16, hy: 0.8, hz: 0.16, kind: "floor" }),
      box({ id: "off-plant", x: hx - 0.4, y: 0.4, z: hz - 0.42, hx: 0.18, hy: 0.4, hz: 0.18, kind: "floor" }),
    );
  }

  if (kind === "basement") {
    items.push(
      box({ id: "base-sofa", x: 0.1, y: 0.4, z: -hz + 1.05, hx: 0.7, hy: 0.4, hz: 0.38, kind: "floor" }),
      box({ id: "base-table", x: 0.1, y: 0.2, z: -hz + 1.95, hx: 0.5, hy: 0.2, hz: 0.28, kind: "floor" }),
      box({ id: "base-plant", x: hx - 0.42, y: 0.4, z: 0.15, hx: 0.18, hy: 0.4, hz: 0.18, kind: "floor" }),
    );
  }

  if (kind === "openplan") {
    items.push(
      box({ id: "op-cab", x: -1.35, y: 0.45, z: -hz + 0.38, hx: 0.38, hy: 0.45, hz: 0.32, group: "op-kit", kind: "floor" }),
      box({ id: "op-sink", x: -0.55, y: 0.45, z: -hz + 0.38, hx: 0.38, hy: 0.45, hz: 0.32, group: "op-kit", kind: "floor" }),
      box({ id: "op-stove", x: 0.25, y: 0.45, z: -hz + 0.38, hx: 0.38, hy: 0.45, hz: 0.32, group: "op-kit", kind: "floor" }),
      box({ id: "op-fridge", x: 1.15, y: 0.85, z: -hz + 0.42, hx: 0.36, hy: 0.85, hz: 0.34, group: "op-kit", kind: "floor" }),
      box({ id: "op-island", x: -0.25, y: 0.4, z: -hz + 1.22, hx: 0.4, hy: 0.4, hz: 0.3, kind: "floor" }),
      box({ id: "op-sofa", x: -hx * 0.32, y: 0.4, z: Math.min(hz - 1.2, -hz + 3.15), hx: 1.05, hy: 0.4, hz: 0.44, kind: "floor" }),
      box({ id: "op-coffee", x: -hx * 0.3, y: 0.2, z: Math.min(hz - 0.35, -hz + 4.05), hx: 0.5, hy: 0.2, hz: 0.28, kind: "floor" }),
    );
  }

  if (kind === "laundry") {
    items.push(
      box({ id: "laun-wash", x: -0.4, y: 0.5, z: -hz + 0.4, hx: 0.34, hy: 0.5, hz: 0.32, kind: "floor" }),
      box({ id: "laun-dry", x: 0.4, y: 0.5, z: -hz + 0.4, hx: 0.34, hy: 0.5, hz: 0.32, kind: "floor" }),
      box({ id: "laun-bench", x: -hx + 0.48, y: 0.3, z: 0.15, hx: 0.42, hy: 0.3, hz: 0.22, kind: "floor" }),
      box({ id: "laun-plant", x: hx - 0.32, y: 0.4, z: hz - 0.36, hx: 0.18, hy: 0.4, hz: 0.18, kind: "floor" }),
    );
  }

  if (kind === "stairs") {
    const stairArt = placeFittedOnWall(kind, spanX, spanZ, "back", 0.32, "end");
    if (stairArt) {
      items.push(box({ id: "stairs-art", x: stairArt.pos, y: 1.48, z: -hz + 0.05, hx: stairArt.half, hy: 0.26, hz: 0.04, mount: "back", kind: "wall" }));
    } else {
      items.push(box({ id: "stairs-art", x: hx * 0.35, y: Math.min(1.0, profile.sill - 0.32), z: -hz + 0.05, hx: 0.26, hy: 0.22, hz: 0.04, mount: "back", kind: "wall" }));
    }
  }

  return items;
}

export function findBox(kind: RoomId, spanX: number, spanZ: number, id: string) {
  return layoutBoxes(kind, spanX, spanZ).find((b) => b.id === id) ?? null;
}

function overlaps1d(a0: number, a1: number, b0: number, b1: number, slack = 0) {
  return a0 < b1 - slack && a1 > b0 + slack;
}


export type Pose = [number, number, number] | { p: [number, number, number]; r?: [number, number, number] };

export function poseOf(kind: RoomId, spanX: number, spanZ: number, id: string, yMode: "ground" | "center" = "ground"): Pose {
  const b = findBox(kind, spanX, spanZ, id);
  if (!b) return [0, 0, 0];
  const y = yMode === "center" ? b.y : 0;
  if (b.rotY != null) return { p: [b.x, y, b.z], r: [0, b.rotY, 0] };
  return [b.x, y, b.z];
}

export type CollisionHit = { a: string; b: string; reason: string };

export function detectCollisions(kind: RoomId, spanX: number, spanZ: number): CollisionHit[] {
  const items = layoutBoxes(kind, spanX, spanZ);
  const openings = roomOpenings(kind, spanX, spanZ);
  const hits: CollisionHit[] = [];
  const hx = spanX / 2;
  const hz = spanZ / 2;

  for (const item of items) {
    if (item.mount && item.kind === "wall") {
      const axis = item.mount === "back" ? { c: item.x, h: item.hx } : { c: item.z, h: item.hz };
      const y0 = item.y - item.hy;
      const y1 = item.y + item.hy;
      for (const open of openings) {
        if (open.wall !== item.mount) continue;
        if (overlaps1d(axis.c - axis.h, axis.c + axis.h, open.min, open.max, 0.02) && overlaps1d(y0, y1, open.y0, open.y1, 0.02)) {
          hits.push({ a: item.id, b: open.id, reason: `wall item overlaps ${open.id} on ${item.mount} wall` });
        }
      }
    }

    if (item.kind === "floor") {
      if (item.x - item.hx < -hx - 0.02 || item.x + item.hx > hx + 0.02 || item.z - item.hz < -hz - 0.02 || item.z + item.hz > hz + 0.02) {
        hits.push({ a: item.id, b: "room", reason: "furniture extends outside the room" });
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.kind !== "floor" || b.kind !== "floor") continue;
      if (a.group && a.group === b.group) continue;
      if (
        overlaps1d(a.x - a.hx, a.x + a.hx, b.x - b.hx, b.x + b.hx, 0.05) &&
        overlaps1d(a.z - a.hz, a.z + a.hz, b.z - b.hz, b.z + b.hz, 0.05) &&
        overlaps1d(a.y - a.hy, a.y + a.hy, b.y - b.hy, b.y + b.hy, 0.02)
      ) {
        hits.push({ a: a.id, b: b.id, reason: "furniture overlaps furniture" });
      }
    }
  }
  return hits;
}
