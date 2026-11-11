export const STAIR_RISER = 0.1778;
export const STAIR_TREAD = 0.254;
export const STAIR_THICK = 0.04;
export const STAIR_NOSING = 0.04;

export type StairFlight = {
  nTreads: number;
  x: number;
  z: number;
  dir: "negZ" | "posX";
  width: number;
  y0: number;
};

export type StairWell = {
  width: number;
  nTreads: number;
  nRisers: number;
  x: number;
  z0: number;
  hallW: number;
  hallL: number;
  landing: number;
  riserH: number;
  treadD: number;
  topY: number;
  turn: boolean;
  flights: StairFlight[];
  landingPos: [number, number, number];
  landingSize: [number, number];
};

export function stairWellFromFeet(lengthFt: number, widthFt: number, wallH = 2.72): StairWell {
  const stairW = Math.min(1.37, Math.max(0.91, widthFt * 0.3048 * 0.26));
  const maxTreads = Math.max(8, Math.round(wallH / STAIR_RISER) - 1);
  const nTreads = Math.min(maxTreads, Math.max(8, Math.round((lengthFt * 0.3048 - 1.2) / STAIR_TREAD)));
  const turn = false;
  if (!turn) {
    const run = nTreads * STAIR_TREAD;
    const landing = 0.88;
    const hallW = stairW + 1.08;
    const hallL = run + landing + 0.5;
    const x = -hallW / 2 + stairW / 2 + 0.08;
    const z0 = hallL / 2 - 0.5 - STAIR_TREAD / 2;
    const topY = nTreads * STAIR_RISER;
    return {
      width: stairW,
      nTreads,
      nRisers: nTreads + 1,
      x,
      z0,
      hallW,
      hallL,
      landing,
      riserH: STAIR_RISER,
      treadD: STAIR_TREAD,
      topY,
      turn: false,
      flights: [{ nTreads, x, z: z0, dir: "negZ", width: stairW, y0: 0 }],
      landingPos: [x, topY, z0 - nTreads * STAIR_TREAD - landing / 2 + STAIR_TREAD / 2],
      landingSize: [stairW + 0.04, landing],
    };
  }

  let n1 = Math.max(5, Math.round(nTreads * 0.55));
  let n2 = nTreads - n1;
  if (n2 < 4) {
    n2 = 4;
    n1 = Math.max(5, nTreads - n2);
  }
  const land = Math.max(1.02, stairW + 0.1);
  const run1 = n1 * STAIR_TREAD;
  const run2 = n2 * STAIR_TREAD;
  const padFront = 0.52;
  const padBack = 0.32;
  const padLeft = 0.16;
  const padRight = 0.55;
  const hallL = padFront + run1 + land + padBack;
  const hallW = padLeft + land + run2 + padRight;
  const landX = -hallW / 2 + padLeft + land / 2;
  const landZ = -hallL / 2 + padBack + land / 2;
  const x = landX - land / 2 + stairW / 2;
  const zLast = landZ + land / 2 + STAIR_TREAD / 2;
  const z0 = zLast + (n1 - 1) * STAIR_TREAD;
  const x2 = landX + land / 2 + STAIR_TREAD / 2;
  const z2 = landZ - land / 2 + stairW / 2;
  const y1 = n1 * STAIR_RISER;
  const topY = (n1 + n2) * STAIR_RISER;
  return {
    width: stairW,
    nTreads: n1 + n2,
    nRisers: n1 + n2 + 1,
    x,
    z0,
    hallW,
    hallL,
    landing: land,
    riserH: STAIR_RISER,
    treadD: STAIR_TREAD,
    topY,
    turn: true,
    flights: [
      { nTreads: n1, x, z: z0, dir: "negZ", width: stairW, y0: 0 },
      { nTreads: n2, x: x2, z: z2, dir: "posX", width: stairW, y0: y1 },
    ],
    landingPos: [landX, y1, landZ],
    landingSize: [land, land],
  };
}

export function stairLayout(spanX: number, spanZ: number, wallH = 2.72): StairWell {
  return stairWellFromFeet(spanZ / 0.3048, spanX / 0.3048, wallH);
}
