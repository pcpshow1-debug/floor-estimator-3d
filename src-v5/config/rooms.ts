export type RoomId =
  | "living"
  | "kitchen"
  | "dining"
  | "bedroom"
  | "bathroom"
  | "entry"
  | "stairs"
  | "office"
  | "basement"
  | "openplan"
  | "laundry";

export type RoomDef = {
  id: RoomId;
  label: string;
  defaultFamily?: "hardwood" | "tile";
  thumb: string;
};

export const rooms: RoomDef[] = [
  { id: "living", label: "Living room", thumb: "/thumbs/living.jpg" },
  { id: "kitchen", label: "Kitchen", thumb: "/thumbs/kitchen.jpg" },
  { id: "dining", label: "Dining room", thumb: "/thumbs/dining.jpg" },
  { id: "bedroom", label: "Bedroom", thumb: "/thumbs/bedroom.jpg" },
  { id: "bathroom", label: "Bathroom", defaultFamily: "tile", thumb: "/thumbs/bathroom.jpg" },
  { id: "entry", label: "Entry / foyer", thumb: "/thumbs/entry.jpg" },
  { id: "stairs", label: "Stairs", thumb: "/thumbs/stairs.jpg" },
  { id: "office", label: "Home office", thumb: "/thumbs/office.jpg" },
  { id: "basement", label: "Basement", thumb: "/thumbs/basement.jpg" },
  { id: "openplan", label: "Open living + kitchen", thumb: "/thumbs/openplan.jpg" },
  { id: "laundry", label: "Laundry / mudroom", defaultFamily: "tile", thumb: "/thumbs/laundry.jpg" },
];

export type RoomProfile = {
  wallColor: string;
  accentColor?: string;
  wallH: number;
  winW: number;
  winH: number;
  sill: number;
  minWindows: number;
  maxWindows: number;
  curtains: boolean;
  wainscot?: boolean;
  beams?: boolean;
  leftCover: number;
  lShape?: boolean;
};

export const roomProfiles: Record<RoomId, RoomProfile> = {
  living: { wallColor: "#e8c9a0", wallH: 2.72, winW: 1.18, winH: 1.46, sill: 0.84, minWindows: 2, maxWindows: 3, curtains: true, leftCover: 1 },
  kitchen: { wallColor: "#efe4d0", wallH: 2.72, winW: 1.12, winH: 1.18, sill: 1.08, minWindows: 1, maxWindows: 3, curtains: false, leftCover: 1 },
  dining: { wallColor: "#e4c49a", wallH: 2.72, winW: 0.92, winH: 1.64, sill: 0.7, minWindows: 2, maxWindows: 3, curtains: true, leftCover: 1 },
  bedroom: { wallColor: "#dfb79a", accentColor: "#c99a7c", wallH: 2.72, winW: 1.12, winH: 1.32, sill: 0.92, minWindows: 1, maxWindows: 2, curtains: true, leftCover: 1 },
  bathroom: { wallColor: "#f0e6d8", wallH: 2.58, winW: 0.7, winH: 0.82, sill: 1.28, minWindows: 1, maxWindows: 2, curtains: false, wainscot: true, leftCover: 1 },
  entry: { wallColor: "#e4d2b4", wallH: 2.72, winW: 0.48, winH: 1.72, sill: 0.32, minWindows: 0, maxWindows: 1, curtains: false, leftCover: 1 },
  stairs: { wallColor: "#e8ddd0", wallH: 2.72, winW: 0.68, winH: 1.12, sill: 1.18, minWindows: 1, maxWindows: 1, curtains: false, leftCover: 1 },
  office: { wallColor: "#c5cedb", wallH: 2.72, winW: 1.18, winH: 1.38, sill: 0.88, minWindows: 1, maxWindows: 2, curtains: true, leftCover: 1 },
  basement: { wallColor: "#d2c6b0", wallH: 2.16, winW: 0.82, winH: 0.5, sill: 1.42, minWindows: 2, maxWindows: 3, curtains: false, beams: true, leftCover: 1 },
  openplan: { wallColor: "#ebd4b4", wallH: 2.72, winW: 1.16, winH: 1.42, sill: 0.86, minWindows: 2, maxWindows: 4, curtains: true, leftCover: 1, lShape: true },
  laundry: { wallColor: "#e6d8c6", wallH: 2.58, winW: 0.78, winH: 0.88, sill: 1.22, minWindows: 1, maxWindows: 1, curtains: false, wainscot: true, leftCover: 1 },
};

export function roomProfile(id: RoomId) {
  return roomProfiles[id];
}

export function roomById(id: string | null | undefined) {
  return rooms.find((room) => room.id === id) ?? null;
}

export type VisualSpec = {
  baseL: number;
  baseW: number;
  grow: number;
  minL: number;
  maxL: number;
  minW: number;
  maxW: number;
  lShape?: boolean;
};

export const visualSpecs: Record<RoomId, VisualSpec> = {
  living: { baseL: 16, baseW: 13.5, grow: 0.28, minL: 12, maxL: 22, minW: 11, maxW: 18 },
  kitchen: { baseL: 13, baseW: 11, grow: 0.25, minL: 10, maxL: 18, minW: 9, maxW: 15 },
  dining: { baseL: 13, baseW: 12, grow: 0.25, minL: 10, maxL: 18, minW: 10, maxW: 16 },
  bedroom: { baseL: 13, baseW: 12, grow: 0.25, minL: 10, maxL: 18, minW: 10, maxW: 16 },
  bathroom: { baseL: 8, baseW: 6.4, grow: 0.12, minL: 6.5, maxL: 10, minW: 5.6, maxW: 8.2 },
  entry: { baseL: 7.2, baseW: 11.5, grow: 0.18, minL: 6, maxL: 11, minW: 8, maxW: 16 },
  stairs: { baseL: 12, baseW: 8, grow: 0.2, minL: 8, maxL: 18, minW: 6, maxW: 12 },
  office: { baseL: 11, baseW: 10, grow: 0.22, minL: 9, maxL: 16, minW: 8, maxW: 14 },
  basement: { baseL: 15, baseW: 13, grow: 0.22, minL: 12, maxL: 22, minW: 11, maxW: 18 },
  openplan: { baseL: 20, baseW: 16, grow: 0.22, minL: 16, maxL: 26, minW: 13, maxW: 20, lShape: true },
  laundry: { baseL: 8, baseW: 7, grow: 0.16, minL: 7, maxL: 12, minW: 6, maxW: 10 },
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function visualFeet(id: RoomId, lengthFt: number, widthFt: number) {
  const spec = visualSpecs[id];
  const length = clamp(spec.baseL + (lengthFt - 18) * spec.grow, spec.minL, spec.maxL);
  const width = clamp(spec.baseW + (widthFt - 14) * spec.grow, spec.minW, spec.maxW);
  return { length, width };
}

export function lShapeHole(spanX: number, spanZ: number) {
  return {
    cutX: -spanX / 2 + spanX * 0.55,
    cutZ: -spanZ / 2 + spanZ * 0.44,
  };
}
