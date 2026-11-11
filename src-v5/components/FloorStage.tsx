"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, MeshReflectorMaterial, OrbitControls } from "@react-three/drei";
import { RoomShell } from "@/components/RoomShell";
import type { RoomId } from "@/config/rooms";
import { STAIR_NOSING, STAIR_RISER, STAIR_TREAD, STAIR_THICK, stairWellFromFeet, type StairWell } from "@/config/stairs";
import { lShapeHole, roomProfile, visualFeet, visualSpecs } from "@/config/rooms";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { grouts, sheenParams, speciesMaps, stainColor, tileMaps, type SheenId } from "@/config/products";
import { patchSpans, piecesFor, type Piece } from "@/lib/layout";

export type SampleState = {
  job: "new" | "refinish";
  family: "hardwood" | "tile";
  species: string;
  pattern: string;
  woodMode: "sealer" | "stain";
  sealerId: string;
  stainId: string;
  sheen: SheenId;
  tileStyle: string;
  grout: string;
  groutWidth: string;
  view: "floor" | "closeup";
  lengthFt: number;
  widthFt: number;
};

const loader = new THREE.TextureLoader();
const colorCache = new Map<string, THREE.Texture>();
const dataCache = new Map<string, THREE.Texture>();

function prep(tex: THREE.Texture, color: boolean) {
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function loadColor(url: string) {
  const hit = colorCache.get(url);
  if (hit) return Promise.resolve(hit);
  return loader.loadAsync(url).then((t) => {
    const tex = prep(t, true);
    colorCache.set(url, tex);
    return tex;
  });
}

function loadData(url: string) {
  const hit = dataCache.get(url);
  if (hit) return Promise.resolve(hit);
  return loader.loadAsync(url).then((t) => {
    const tex = prep(t, false);
    dataCache.set(url, tex);
    return tex;
  });
}

function hexToVec(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function tagGeometry(geo: THREE.BufferGeometry, bevel = 0) {
  geo.setAttribute("aMeta", new THREE.InstancedBufferAttribute(new Float32Array([0.2, 0.08, 1, 0]), 4));
  geo.setAttribute("aBevel", new THREE.InstancedBufferAttribute(new Float32Array([bevel]), 1));
}

function boxGeo() {
  const geo = new THREE.BoxGeometry(1, 0.016, 1);
  geo.translate(0, 0.008, 0);
  tagGeometry(geo, 1);
  return geo;
}

function hexGeo() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = 0.0145 * Math.cos(a);
    const y = 0.0145 * Math.sin(a);
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0007,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  tagGeometry(geo, 0);
  return geo;
}

function chevronGeo(sign: number, length: number, width: number) {
  const s = sign < 0 ? -1 : 1;
  const hx = (s * length) / (2 * Math.SQRT2);
  const hz = length / (2 * Math.SQRT2);
  const hs = width / Math.SQRT2;
  const pts: [number, number][] = [
    [-hx, -hz - hs],
    [hx, hz - hs],
    [hx, hz + hs],
    [-hx, -hz + hs],
  ];
  const shape = new THREE.Shape();
  pts.forEach(([x, z], i) => {
    i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0009,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minX = Math.min(minX, pos.getX(i));
    maxX = Math.max(maxX, pos.getX(i));
    minZ = Math.min(minZ, pos.getZ(i));
    maxZ = Math.max(maxZ, pos.getZ(i));
  }
  const uv = new Float32Array(pos.count * 2);
  const sx = Math.max(1e-4, maxX - minX);
  const sz = Math.max(1e-4, maxZ - minZ);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = (pos.getX(i) - minX) / sx;
    uv[2 * i + 1] = (pos.getZ(i) - minZ) / sz;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  tagGeometry(geo, 0);
  return geo;
}

function InstancedPieces({
  pieces,
  geometry,
  material,
  scaled,
  bevel,
  progress,
  playing,
}: {
  pieces: Piece[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  scaled: boolean;
  bevel: boolean;
  progress: React.MutableRefObject<number>;
  playing: React.MutableRefObject<boolean>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const alloc = useRef(Math.max(pieces.length + 256, 16384));
  if (pieces.length > alloc.current) alloc.current = pieces.length + 512;

  function apply(p: number) {
    const inst = mesh.current;
    if (!inst) return;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const start = playing.current ? 1 - (1 - Math.min(1, Math.max(0, (p - 0.62 * piece.order) / 0.5))) ** 3 : 1;
      const lift = 1 - start;
      tmp.position.set(piece.x, 0.002 + 0.28 * lift, piece.z);
      tmp.rotation.order = "YXZ";
      tmp.rotation.set(playing.current ? 2.2 * lift : 0, piece.rot, 0);
      tmp.scale.set(scaled ? piece.len : 1, 1, scaled ? piece.wid : 1);
      tmp.updateMatrix();
      inst.setMatrixAt(i, tmp.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  useLayoutEffect(() => {
    const inst = mesh.current;
    if (!inst || !pieces.length) return;
    const meta = new Float32Array(pieces.length * 4);
    const bev = new Float32Array(pieces.length);
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      meta[4 * i] = Math.max(piece.len, 0.01);
      meta[4 * i + 1] = Math.max(piece.wid, 0.01);
      meta[4 * i + 2] = piece.shade;
      meta[4 * i + 3] = piece.shift;
      bev[i] = bevel ? 1 : 0;
    }
    geometry.setAttribute("aMeta", new THREE.InstancedBufferAttribute(meta, 4));
    geometry.setAttribute("aBevel", new THREE.InstancedBufferAttribute(bev, 1));
    inst.count = pieces.length;
    apply(playing.current ? progress.current : 1);
  }, [geometry, pieces, bevel]);

  const last = useRef(-1);
  useFrame(() => {
    const p = playing.current ? progress.current : 1;
    if (Math.abs(p - last.current) < 1e-4) return;
    last.current = p;
    apply(p);
  });

  if (!pieces.length) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, alloc.current]} frustumCulled={false} dispose={null} receiveShadow />;
}

function fitRoomCamera(sx: number, sz: number, aspect: number, fovDeg: number, wallH = 2.72, roomKey = "") {
  const stairs = roomKey === "stairs";
  const vFov = THREE.MathUtils.degToRad(fovDeg);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.55, aspect));
  const hx = sx / 2;
  const hz = sz / 2;
  const pad = stairs ? (aspect > 1.05 ? 1.22 : 1.32) : aspect > 1.05 ? 1.16 : 1.32;
  const extentY = Math.max(wallH * (stairs ? 0.48 : 0.38) + Math.hypot(hx, hz) * (stairs ? 0.32 : 0.44), stairs ? 0 : wallH * 0.92);
  const extentW = Math.max(Math.hypot(sx, sz) * (stairs ? 0.5 : 0.56), stairs ? 0 : wallH * 1.02);
  const minDist = stairs ? 4.2 : 4.5;
  const dist = Math.max((extentY * pad) / Math.tan(vFov / 2), (extentW * pad) / Math.tan(hFov / 2), minDist);
  const dir = (stairs ? new THREE.Vector3(1.05, 0.52, 0.62) : new THREE.Vector3(0.78, 0.6, 0.96)).normalize();
  const look = new THREE.Vector3(stairs ? -hx * 0.12 : 0, stairs ? wallH * 0.38 : Math.min(0.8, wallH * (Math.hypot(hx, hz) < 2.2 ? 0.34 : 0.26)), stairs ? 0.05 : -hz * 0.05);
  return { pos: look.clone().addScaledVector(dir, dist), look };
}


function StairTreads({ well, material }: { well: StairWell; material: THREE.Material }) {
  return (
    <group>
      {well.flights.flatMap((fl, fi) =>
        Array.from({ length: fl.nTreads }, (_, i) => {
          const y = fl.y0 + (i + 1) * STAIR_RISER - STAIR_THICK / 2;
          if (fl.dir === "negZ") {
            const z = fl.z - i * STAIR_TREAD;
            return (
              <group key={`${fi}-${i}`}>
                <mesh position={[fl.x, y, z - STAIR_NOSING / 2]} material={material} castShadow receiveShadow>
                  <boxGeometry args={[fl.width + 0.02, STAIR_THICK, STAIR_TREAD + STAIR_NOSING]} />
                </mesh>
                <mesh position={[fl.x, y + STAIR_THICK / 2 + 0.004, z - STAIR_TREAD / 2 - STAIR_NOSING + 0.01]} material={material} castShadow>
                  <boxGeometry args={[fl.width + 0.03, 0.012, 0.022]} />
                </mesh>
              </group>
            );
          }
          const x = fl.x + i * STAIR_TREAD;
          return (
            <group key={`${fi}-${i}`}>
              <mesh position={[x + STAIR_NOSING / 2, y, fl.z]} material={material} castShadow receiveShadow>
                <boxGeometry args={[STAIR_TREAD + STAIR_NOSING, STAIR_THICK, fl.width + 0.02]} />
              </mesh>
              <mesh position={[x + STAIR_TREAD / 2 + STAIR_NOSING - 0.01, y + STAIR_THICK / 2 + 0.004, fl.z]} material={material} castShadow>
                <boxGeometry args={[0.022, 0.012, fl.width + 0.03]} />
              </mesh>
            </group>
          );
        }),
      )}
      <mesh position={[well.landingPos[0], well.landingPos[1] - STAIR_THICK / 2, well.landingPos[2]]} material={material} castShadow receiveShadow>
        <boxGeometry args={[well.landingSize[0], STAIR_THICK, well.landingSize[1]]} />
      </mesh>
    </group>
  );
}

function CameraRig({
  view,
  hold,
  vis,
  targetX,
  targetZ,
  mode = "sample",
  wallH = 2.72,
  stairs = false,
  roomKey = "",
}: {
  view: "floor" | "closeup";
  hold: React.MutableRefObject<boolean>;
  vis: React.MutableRefObject<{ x: number; z: number }>;
  targetX: number;
  targetZ: number;
  mode?: "sample" | "room";
  wallH?: number;
  stairs?: boolean;
  roomKey?: string;
}) {
  const { camera, controls, size } = useThree() as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3 } | null;
    size: { width: number; height: number };
  };
  const goal = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(0, 0.014, 0), []);
  const settling = useRef(true);
  const lastView = useRef(view);
  if (lastView.current !== view) {
    lastView.current = view;
    settling.current = true;
  }
  const fitKey = `${mode}|${roomKey}|${targetX.toFixed(3)}|${targetZ.toFixed(3)}|${size.width}|${size.height}`;
  const lastFit = useRef(fitKey);
  if (lastFit.current !== fitKey) {
    lastFit.current = fitKey;
    settling.current = true;
  }
  useEffect(() => {
    hold.current = false;
  }, [view, hold]);
  useEffect(() => {
    if (mode === "room") hold.current = false;
  }, [targetX, targetZ, mode, hold, size.width, size.height]);
  useFrame((_, dt) => {
    if (!controls || hold.current) return;
    const spanX = vis.current.x;
    const spanZ = vis.current.z;
    const wide = size.width / Math.max(1, size.height) > 1.05;
    const scale = Math.hypot(spanX, spanZ) / Math.hypot(1.22, 1.22);
    let pos: number[];
    if (mode === "room") {
      const fitted = fitRoomCamera(spanX, spanZ, size.width / Math.max(1, size.height), camera.fov || 36, wallH, roomKey);
      pos = [fitted.pos.x, fitted.pos.y, fitted.pos.z];
      look.copy(fitted.look);
    } else if (view === "closeup") {
      pos = wide ? [0.28, 0.42, 0.3] : [0.18, 0.34, 0.2];
    } else {
      pos = wide ? [1.48 * scale, 2.15 * scale, 1.55 * scale] : [2.05 * scale, 3.05 * scale, 2.15 * scale];
    }
    goal.set(pos[0], pos[1], pos[2]);
    const resizing = Math.hypot(spanX - targetX, spanZ - targetZ) > 0.0008;
    if (!resizing && !settling.current) return;
    const k = 1 - Math.exp(-((mode === "room" ? 1.08 : 1.75) * dt));
    camera.position.lerp(goal, k);
    controls.target.lerp(look, k);
    if (!resizing && camera.position.distanceTo(goal) < 0.04) settling.current = false;
  });
  return null;
}

function ResizeFix() {
  const { gl, camera } = useThree();
  useEffect(() => {
    const sync = () => {
      const el = gl.domElement.parentElement;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;
      gl.setSize(w, h, false);
      const cam = camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) {
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
    };
    const onOrient = () => window.setTimeout(sync, 120);
    window.addEventListener("orientationchange", onOrient);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    sync();
    return () => {
      window.removeEventListener("orientationchange", onOrient);
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, [gl, camera]);
  return null;
}

function SpanFollow({
  spanX,
  spanZ,
  vis,
  planes,
  base,
  shadow,
}: {
  spanX: number;
  spanZ: number;
  vis: React.MutableRefObject<{ x: number; z: number }>;
  planes: THREE.Plane[];
  base: React.MutableRefObject<THREE.Mesh | null>;
  shadow: React.MutableRefObject<THREE.Mesh | null>;
}) {
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-(2.15 * dt));
    vis.current.x += (spanX - vis.current.x) * k;
    vis.current.z += (spanZ - vis.current.z) * k;
    if (Math.abs(vis.current.x - spanX) < 0.0008) vis.current.x = spanX;
    if (Math.abs(vis.current.z - spanZ) < 0.0008) vis.current.z = spanZ;
    const hx = vis.current.x / 2 + 0.001;
    const hz = vis.current.z / 2 + 0.001;
    planes[0].constant = hx;
    planes[1].constant = hx;
    planes[2].constant = hz;
    planes[3].constant = hz;
    if (base.current) base.current.scale.set(vis.current.x, 1, vis.current.z);
    if (shadow.current) shadow.current.scale.set(vis.current.x * 1.68, vis.current.z * 1.68, 1);
  });
  return null;
}



function FloorGlow({
  spanX,
  spanZ,
  sheen,
  tile,
  quality,
  hole,
  evening,
}: {
  spanX: number;
  spanZ: number;
  sheen: string;
  tile: boolean;
  quality: "high" | "low";
  hole: { cutX: number; cutZ: number } | null;
  evening: boolean;
}) {
  const rank = sheen === "gloss" ? 1 : sheen === "semi-gloss" || sheen === "semi" ? 0.62 : sheen === "satin" ? 0.32 : 0.04;
  const strength = tile && rank > 0.3 ? rank : rank;
  const res = quality === "low" ? 256 : strength > 0.55 ? 512 : 384;
  if (strength < 0.08) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -spanZ * 0.18]} renderOrder={3}>
        <circleGeometry args={[0.62, 28]} />
        <meshBasicMaterial color={evening ? "#ffb070" : "#ffe6b4"} transparent opacity={evening ? 0.05 : 0.14} depthWrite={false} />
      </mesh>
    );
  }
  const planes = hole
    ? [
        { pos: [0, 0.003, (-spanZ / 2 + (hole.cutZ + spanZ / 2) / 2)] as [number, number, number], size: [spanX, hole.cutZ + spanZ / 2] as [number, number] },
        { pos: [(-spanX / 2 + (hole.cutX + spanX / 2) / 2), 0.003, (hole.cutZ + spanZ / 2) / 2] as [number, number, number], size: [hole.cutX + spanX / 2, spanZ / 2 - hole.cutZ] as [number, number] },
      ]
    : [{ pos: [0, 0.003, 0] as [number, number, number], size: [spanX, spanZ] as [number, number] }];
  return (
    <group>
      {planes.map((pl, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={pl.pos} renderOrder={2}>
          <planeGeometry args={pl.size} />
          <MeshReflectorMaterial
            blur={strength > 0.85 ? [28, 10] : strength > 0.5 ? [90, 32] : [220, 70]}
            resolution={res}
            mixBlur={Math.max(0.18, 0.95 - strength * 0.72)}
            mixStrength={0.22 + strength * 1.15}
            roughness={0.1 + (1 - strength) * 0.58}
            metalness={0.06 * strength}
            mirror={0.18 + strength * 0.58}
            depthScale={0.35}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.15}
            color={strength > 0.7 ? "#8f7a62" : "#a89078"}
            transparent
            opacity={0.28 + strength * 0.34}
          />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -spanZ * 0.18]} renderOrder={3}>
        <circleGeometry args={[0.7, 28]} />
        <meshBasicMaterial color={evening ? "#ffb070" : "#ffe7b0"} transparent opacity={evening ? 0.05 : 0.13} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SampleScene({
  state,
  anim,
  nonce,
  reduceMotion,
  onAnimDone,
  captureApi,
  layout,
  roomId,
  ghost,
  evening = false,
  showRug = true,
  quality = "high",
}: {
  state: SampleState;
  anim: "lay" | "refinish" | null;
  nonce: number;
  reduceMotion: boolean;
  onAnimDone: () => void;
  captureApi: React.MutableRefObject<(() => string) | null>;
  layout: "sample" | "room";
  roomId?: RoomId;
  ghost: number;
  evening?: boolean;
  showRug?: boolean;
  quality?: "high" | "low";
}) {
  const maps = useMemo(() => {
    if (state.job === "new" && state.family === "tile") {
      const files = tileMaps(state.tileStyle);
      const matte = state.tileStyle === "slate" || state.tileStyle === "terracotta";
      return {
        kind: "tile" as const,
        albedo: files.color,
        worn: null as string | null,
        alt: files.alt,
        normal: files.normal,
        rough: files.rough,
        uv: 0,
        boards: 1,
        grain: state.tileStyle === "wood-look" ? 0 : 0,
        grout: grouts.find((g) => g.id === state.grout)?.color ?? "#b9b4ae",
        stain: "#ffffff",
        stainAmt: 0,
        checker: state.tileStyle === "checkerboard" ? 1 : 0,
        tileSheen: matte ? "satin" : "semi",
      };
    }
    const species = state.job === "refinish" ? "white-oak" : state.species;
    const finishId = state.woodMode === "sealer" ? state.sealerId : state.stainId;
    const files = speciesMaps(species);
    return {
      kind: "wood" as const,
      albedo: files.color,
      worn: state.job === "refinish" ? "/textures/worn/color.webp" : null,
      alt: null as string | null,
      normal: files.normal,
      rough: files.rough,
      uv: 0,
      boards: species === "white-oak" || species === "red-oak" || species === "worn" ? 8 : 1,
      grain: species === "walnut" ? 1 : 0,
      grout: "#151210",
      stain: stainColor(state.woodMode, finishId),
      stainAmt: (state.woodMode === "sealer" && (finishId === "natural-seal" || finishId === "classic-seal") ? 0.42 : 0.78) * (species === "walnut" ? 0.36 : 1),
      checker: 0,
      tileSheen: "semi",
    };
  }, [state]);

  const stairWell = roomId === "stairs" ? stairWellFromFeet(state.lengthFt ?? 12, state.widthFt ?? 8) : null;
  const visFeet = roomId && roomId !== "stairs" ? visualFeet(roomId, state.lengthFt ?? 18, state.widthFt ?? 14) : null;
  const rawSpans = patchSpans(state.lengthFt ?? 18, state.widthFt ?? 14);
  const spanX = stairWell ? stairWell.hallW : visFeet ? visFeet.length * 0.3048 : rawSpans.spanX;
  const spanZ = stairWell ? stairWell.hallL : visFeet ? visFeet.width * 0.3048 : rawSpans.spanZ;
  const isL = !!(roomId && visualSpecs[roomId].lShape);
  const hole = isL ? lShapeHole(spanX, spanZ) : null;

  const pieces = useMemo(
    () =>
      piecesFor(
        stairWell
          ? { ...state, lengthFt: stairWell.hallW / 0.3048, widthFt: stairWell.hallL / 0.3048 }
          : visFeet
            ? { ...state, lengthFt: visFeet.length, widthFt: visFeet.width }
            : state,
      ),
    [state.job, state.family, state.pattern, state.tileStyle, state.lengthFt, state.widthFt, state.groutWidth, stairWell?.hallW, stairWell?.hallL, visFeet?.length, visFeet?.width],
  );

  const vis = useRef({ x: spanX, z: spanZ });
  const baseRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const planes = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), spanX / 2 + 0.001),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), spanX / 2 + 0.001),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), spanZ / 2 + 0.001),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), spanZ / 2 + 0.001),
    ],
    [],
  );

  const shadowMap = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(128, 128, 16, 128, 128, 128);
    g.addColorStop(0, "rgba(0,0,0,0.42)");
    g.addColorStop(0.28, "rgba(0,0,0,0.18)");
    g.addColorStop(0.62, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const userHold = useRef(false);
  const progress = useRef(anim !== "lay" || reduceMotion ? 1 : 0);
  const sand = useRef(anim !== "refinish" || reduceMotion ? 1 : 0);
  const coat = useRef(anim !== "refinish" || reduceMotion ? 1 : 0);
  const glint = useRef(0);
  const playing = useRef(anim === "lay" && !reduceMotion && layout !== "room");
  const elapsed = useRef(0);
  const seen = useRef(-1);
  if (seen.current !== nonce) {
    seen.current = nonce;
    elapsed.current = 0;
    playing.current = anim === "lay" && !reduceMotion && layout !== "room";
    progress.current = playing.current ? 0 : 1;
    sand.current = anim !== "refinish" || reduceMotion ? 1 : 0;
    coat.current = anim !== "refinish" || reduceMotion ? 1 : 0;
    glint.current = 0;
  }

  const gl = useThree((s) => s.gl);
  useEffect(() => {
    captureApi.current = () => gl.domElement.toDataURL("image/jpeg", 0.72);
  }, [captureApi, gl]);
  useEffect(() => {
    if (!anim) {
      playing.current = false;
      progress.current = 1;
      sand.current = 1;
      coat.current = 1;
      glint.current = 0;
    }
  }, [anim]);
  useEffect(() => {
    if (layout === "room" && anim) onAnimDone();
  }, [anim, layout, onAnimDone]);

  const boxes = useMemo(() => pieces.filter((p) => p.shape === "box"), [pieces]);
  const chevL = useMemo(() => pieces.filter((p) => p.shape === "chevron" && p.flip < 0), [pieces]);
  const chevR = useMemo(() => pieces.filter((p) => p.shape === "chevron" && p.flip >= 0), [pieces]);
  const hexes = useMemo(() => pieces.filter((p) => p.shape === "hex"), [pieces]);
  const geoBox = useMemo(() => boxGeo(), []);
  const geoHex = useMemo(() => (hexes.length ? hexGeo() : null), [hexes.length]);
  const geoChevL = useMemo(() => (chevL[0] ? chevronGeo(-1, chevL[0].len, chevL[0].wid) : null), [chevL]);
  const geoChevR = useMemo(() => (chevR[0] ? chevronGeo(1, chevR[0].len, chevR[0].wid) : null), [chevR]);

  const material = useMemo(() => {
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.colorSpace = THREE.SRGBColorSpace;
    white.needsUpdate = true;
    const nrm = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    nrm.needsUpdate = true;
    const mat = new THREE.MeshPhysicalMaterial({
      map: white,
      normalMap: nrm,
      roughness: 0.45,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.5,
      clippingPlanes: planes,
      clipShadows: true,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    mat.normalScale = new THREE.Vector2(0.55, 0.55);
    mat.userData.uniforms = {
      uMapB: { value: white },
      uWorn: { value: white },
      uMix: { value: 0 },
      uSand: { value: 1 },
      uSandOn: { value: 0 },
      uGlint: { value: 0 },
      uUvMode: { value: 0 },
      uBoards: { value: 8 },
      uGrain: { value: 0 },
      uTexM: { value: 2.05 },
      uStain: { value: new THREE.Vector3(1, 1, 1) },
      uStainAmt: { value: 0 },
      uChecker: { value: 0 },
      uAlt: { value: white },
      uLShape: { value: 0 },
      uLHole: { value: new THREE.Vector4(99, 99, 99, 99) },
    };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, mat.userData.uniforms);
      shader.vertexShader =
        "uniform float uUvMode;\nuniform float uBoards;\nuniform float uGrain;\nuniform float uTexM;\nattribute vec4 aMeta;\nattribute float aBevel;\nvarying vec3 vWorld;\nvarying vec2 vSize;\nvarying vec2 vUvRaw;\nvarying float vShade;\nvarying float vBevelOn;\nvarying vec3 vWorldN;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
        vShade = aMeta.z;
        vSize = aMeta.xy;
        vUvRaw = uv;
        vBevelOn = aBevel;
        vec2 cuv;
        if (uUvMode < 0.5) {
          float spanV = clamp(aMeta.x / max(uTexM, 0.5), 0.1, 0.62);
          float pick = fract(aMeta.w * 5.73);
          float start = pick < 0.5
            ? mix(0.01, max(0.01, 0.38 - spanV), fract(aMeta.w * 3.1))
            : mix(0.42, max(0.42, 0.99 - spanV), fract(aMeta.w * 7.7));
          float along = start + uv.x * spanV;
          float across;
          if (uBoards > 1.5) {
            float board = floor(fract(aMeta.w * 0.993) * uBoards);
            float inset = 0.07;
            float jitter = (fract(aMeta.w * 11.3) - 0.5) * 0.04;
            across = (board + inset + uv.y * (1.0 - 2.0 * inset)) / uBoards + jitter;
          } else {
            float v0 = fract(aMeta.w * 0.81);
            float vSpan = clamp(aMeta.y / max(uTexM, 0.5), 0.1, 0.55);
            across = v0 + uv.y * vSpan;
          }
          if (fract(aMeta.w * 2.37) > 0.5) along = 1.0 - along;
          if (fract(aMeta.w * 4.13) > 0.5) across = 1.0 - across;
          cuv = uGrain < 0.5 ? vec2(across, along) : vec2(along, across);
        } else if (uUvMode < 1.5) {
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          cuv = wp.xz * 1.25 + vec2(aMeta.w * 0.04);
        } else {
          cuv = uv;
        }
        #ifdef USE_MAP
          vMapUv = cuv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = cuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = cuv;
        #endif`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `vec4 vipWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          vipWorld = instanceMatrix * vipWorld;
        #endif
        vipWorld = modelMatrix * vipWorld;
        vWorld = vipWorld.xyz;
        vec3 nrm = normal;
        #ifdef USE_INSTANCING
          nrm = mat3(instanceMatrix) * nrm;
        #endif
        vWorldN = normalize(mat3(modelMatrix) * nrm);
        #include <project_vertex>`,
      );
      shader.fragmentShader =
        "uniform sampler2D uMapB;\nuniform sampler2D uWorn;\nuniform sampler2D uAlt;\nuniform float uMix;\nuniform float uSand;\nuniform float uSandOn;\nuniform float uGlint;\nuniform float uChecker;\nuniform vec3 uStain;\nuniform float uStainAmt;\nuniform float uGrain;\nuniform float uLShape;\nuniform vec4 uLHole;\nvarying vec3 vWorld;\nvarying vec2 vSize;\nvarying vec2 vUvRaw;\nvarying float vShade;\nvarying float vBevelOn;\nvarying vec3 vWorldN;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          if (uLShape > 0.5 && vWorld.x > uLHole.x && vWorld.z > uLHole.z) discard;
          vec4 sampA = texture2D(map, vMapUv);
          vec4 sampB = texture2D(uMapB, vMapUv);
          vec4 fresh = mix(sampA, sampB, clamp(uMix, 0.0, 1.0));
          vec4 wornCol = texture2D(uWorn, vMapUv);
          float sweep = uSand * 1.7 - 0.85;
          float wiped = smoothstep(sweep + 0.06, sweep - 0.16, vWorld.x);
          float reveal = mix(1.0, wiped, uSandOn);
          vec3 raw = mix(wornCol.rgb, fresh.rgb, reveal);
          raw = mix(raw, texture2D(uAlt, vMapUv).rgb, uChecker * step(0.5, 1.0 - vShade));
          float lum = dot(raw, vec3(0.2126, 0.7152, 0.0722));
          float stainLum = dot(uStain, vec3(0.2126, 0.7152, 0.0722));
          vec3 chroma = raw / max(vec3(lum), vec3(0.04));
          vec3 multiplied = raw * (uStain / max(vec3(stainLum), vec3(0.06)));
          vec3 replaced = uStain * chroma * (1.0 + (lum - 0.42) * 0.7);
          vec3 stained = mix(multiplied, replaced, mix(0.18, 0.48, 1.0 - stainLum));
          stained *= mix(1.0, 0.72, smoothstep(0.22, 0.02, stainLum));
          float amt = clamp(uStainAmt, 0.0, 1.0) * mix(0.55, 0.86, 1.0 - stainLum);
          vec3 colored = mix(raw, stained, amt);
          float brim = min(min(vUvRaw.x, 1.0 - vUvRaw.x) * max(vSize.x, 0.04), min(vUvRaw.y, 1.0 - vUvRaw.y) * max(vSize.y, 0.02));
          float bevel = mix(1.0, smoothstep(0.0, 0.0022, brim), max(vBevelOn, 0.55));
          float faceUp = smoothstep(0.22, 0.7, abs(normalize(vWorldN).y));
          float varScale = mix(0.65, 1.85, 1.0 - stainLum);
          colored *= 1.0 + (vShade - 0.96) * varScale;
          float gapDark = mix(0.74, 0.56, 1.0 - stainLum);
          colored *= mix(gapDark, 1.0, bevel);
          colored *= mix(vec3(0.035, 0.028, 0.024), vec3(1.0), faceUp);
          colored *= mix(vec3(1.0), vec3(0.84, 0.94, 1.14), clamp(uGrain, 0.0, 1.0) * 0.78);
          vec4 sampledDiffuseColor = vec4(colored, 1.0);
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float band = exp(-pow((vWorld.x * 0.85 + vWorld.z * 0.5 - (uGlint * 1.9 - 0.95)) * 8.0, 2.0));
        totalEmissiveRadiance += vec3(1.0, 0.98, 0.93) * band * smoothstep(0.0, 0.12, uGlint) * (1.0 - smoothstep(0.8, 1.0, uGlint)) * 1.15;`,
      );
    };
    mat.customProgramCacheKey = () => "vipro-sample-v12";
    return mat;
  }, [planes]);

  const treadMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.75,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }), []);

  const fade = useRef({ mix: 0, target: "", pending: false, stain: new THREE.Vector3(1, 1, 1), stainAmt: 0 });

  useEffect(() => {
    let dead = false;
    const u = material.userData.uniforms;
    u.uUvMode.value = maps.uv;
    u.uBoards.value = maps.boards;
    u.uGrain.value = maps.grain;
    loadColor(maps.albedo).then((tex) => {
      if (dead) return;
      if (!fade.current.target) {
        material.map = tex;
        u.uMapB.value = tex;
        u.uMix.value = 0;
        fade.current = { ...fade.current, mix: 0, target: maps.albedo, pending: false };
        return;
      }
      material.map = u.uMapB.value;
      u.uMix.value = 0;
      u.uMapB.value = tex;
      fade.current = { ...fade.current, mix: 0, target: maps.albedo, pending: true };
    });
    if (maps.worn) {
      loadColor(maps.worn).then((tex) => {
        if (!dead) u.uWorn.value = tex;
      });
    }
    loadData(maps.normal).then((tex) => {
      if (!dead) material.normalMap = tex;
    });
    loadData(maps.rough).then((tex) => {
      if (!dead) {
        material.roughnessMap = tex;
        material.needsUpdate = true;
      }
    });
    if (maps.alt) {
      loadColor(maps.alt).then((tex) => {
        if (!dead) u.uAlt.value = tex;
      });
    }
    u.uChecker.value = maps.checker;
    return () => {
      dead = true;
    };
  }, [maps.albedo, maps.normal, maps.rough, maps.uv, maps.worn, material]);

  useFrame((_, dt) => {
    const duration = anim === "lay" ? 0.95 : anim === "refinish" ? 1.15 : 0;
    if (anim && elapsed.current < duration) {
      elapsed.current = Math.min(duration, elapsed.current + (reduceMotion ? duration : dt));
      const e = duration === 0 ? 1 : elapsed.current / duration;
      if (anim === "lay") progress.current = e;
      if (anim === "refinish") {
        progress.current = 1;
        sand.current = Math.min(1, e / 0.52);
        coat.current = THREE.MathUtils.smoothstep(e, 0.4, 0.92);
        glint.current = coat.current;
      }
      if (elapsed.current >= duration) onAnimDone();
    }
    const u = material.userData.uniforms;
    if (fade.current.pending) {
      fade.current.mix = Math.min(1, fade.current.mix + dt / 0.48);
      u.uMix.value = fade.current.mix;
      if (fade.current.mix >= 1) {
        material.map = u.uMapB.value;
        u.uMix.value = 0;
        fade.current.mix = 0;
        fade.current.pending = false;
      }
    }
    const targetStain = hexToVec(maps.stain);
    fade.current.stain.lerp(targetStain, 1 - Math.exp(-8 * dt));
    fade.current.stainAmt = THREE.MathUtils.lerp(fade.current.stainAmt, maps.stainAmt, 1 - Math.exp(-8 * dt));
    u.uStain.value.copy(fade.current.stain);
    u.uStainAmt.value = fade.current.stainAmt;

    const sheen = maps.kind === "tile" ? sheenParams[maps.tileSheen as "satin" | "semi"] : sheenParams[state.sheen];
    const ready = coat.current;
    const k = 1 - Math.exp(-(7 * dt));
    material.roughness = THREE.MathUtils.lerp(material.roughness, THREE.MathUtils.lerp(0.95, sheen.roughness, ready), k);
    material.clearcoat = THREE.MathUtils.lerp(material.clearcoat, sheen.clearcoat * (0.12 + 0.88 * ready), k);
    material.clearcoatRoughness = THREE.MathUtils.lerp(material.clearcoatRoughness, sheen.clearcoatRoughness, k);
    material.envMapIntensity = THREE.MathUtils.lerp(material.envMapIntensity, sheen.env * (0.22 + 0.78 * ready), k);
    treadMat.map = material.map;
    treadMat.normalMap = material.normalMap;
    treadMat.roughnessMap = material.roughnessMap;
    treadMat.roughness = material.roughness;
    treadMat.clearcoat = material.clearcoat;
    treadMat.clearcoatRoughness = material.clearcoatRoughness;
    treadMat.envMapIntensity = material.envMapIntensity * 1.05;
    if (maps.kind === "tile") treadMat.color.set("#ffffff");
    else treadMat.color.set(maps.stain);
    treadMat.needsUpdate = true;
    u.uSand.value = sand.current;
    u.uSandOn.value = maps.worn && sand.current < 0.999 ? 1 : 0;
    u.uLShape.value = hole ? 1 : 0;
    if (hole) u.uLHole.value.set(hole.cutX, 40, hole.cutZ, 40);
    else u.uLHole.value.set(99, 99, 99, 99);
    u.uGlint.value = maps.worn ? glint.current : 0;
  });

  return (
    <>
      <color attach="background" args={["#ffffff"]} />
      {layout !== "room" && (
        <>
          <hemisphereLight args={["#ffffff", "#efeae2", 0.3]} />
          <directionalLight position={[2.6, 4.4, 1.8]} intensity={0.46} />
          <directionalLight position={[-2.4, 2.2, -1.6]} intensity={0.16} />
        </>
      )}
      <Suspense fallback={null}>
        <Environment files="/hdr/studio.hdr" environmentIntensity={layout === "room" ? 1.28 : 1.02} />
      </Suspense>
      <ResizeFix />
      <SpanFollow spanX={spanX} spanZ={spanZ} vis={vis} planes={planes} base={baseRef} shadow={shadowRef} />
      {shadowMap && layout !== "room" && (
        <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.028, 0]} scale={[spanX * 1.68, spanZ * 1.68, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowMap} transparent depthWrite={false} />
        </mesh>
      )}
      <mesh ref={baseRef} position={[0, -0.01, 0]} scale={[spanX, 1, spanZ]} visible={!hole}>
        <boxGeometry args={[1, 0.022, 1]} />
        <meshStandardMaterial color={maps.grout} roughness={0.94} metalness={0} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      {hole && (
        <>
          <mesh position={[0, -0.01, -spanZ / 2 + (hole.cutZ + spanZ / 2) / 2]} scale={[spanX, 1, Math.max(0.2, hole.cutZ + spanZ / 2)]}>
            <boxGeometry args={[1, 0.022, 1]} />
            <meshStandardMaterial color={maps.grout} roughness={0.94} metalness={0} />
          </mesh>
          <mesh position={[(-spanX / 2 + (hole.cutX + spanX / 2) / 2), -0.01, (hole.cutZ + spanZ / 2) / 2]} scale={[Math.max(0.2, hole.cutX + spanX / 2), 1, Math.max(0.2, spanZ / 2 - hole.cutZ)]}>
            <boxGeometry args={[1, 0.022, 1]} />
            <meshStandardMaterial color={maps.grout} roughness={0.94} metalness={0} />
          </mesh>
        </>
      )}
      {boxes.length > 0 && (
        <InstancedPieces pieces={boxes} geometry={geoBox} material={material} scaled bevel progress={progress} playing={playing} />
      )}
      {geoChevL && chevL.length > 0 && (
        <InstancedPieces pieces={chevL} geometry={geoChevL} material={material} scaled={false} bevel progress={progress} playing={playing} />
      )}
      {geoChevR && chevR.length > 0 && (
        <InstancedPieces pieces={chevR} geometry={geoChevR} material={material} scaled={false} bevel progress={progress} playing={playing} />
      )}
      {geoHex && hexes.length > 0 && (
        <InstancedPieces pieces={hexes} geometry={geoHex} material={material} scaled={false} bevel={false} progress={progress} playing={playing} />
      )}
      {layout === "room" && (
        <FloorGlow spanX={spanX} spanZ={spanZ} sheen={state.sheen} tile={maps.kind === "tile"} quality={quality} hole={hole} evening={evening} />
      )}
      {layout === "room" && roomId && (
        <RoomShell kind={roomId} spanX={spanX} spanZ={spanZ} ghost={ghost} vis={vis} stairWell={stairWell} evening={evening} showRug={showRug} />
      )}
      {layout === "room" && roomId === "stairs" && stairWell && (
        <StairTreads well={stairWell} material={treadMat} />
      )}
      <CameraRig view={state.view} hold={userHold} vis={vis} targetX={spanX} targetZ={spanZ} mode={layout} wallH={roomId ? roomProfile(roomId).wallH : 2.72} stairs={roomId === "stairs"} roomKey={roomId ?? ""} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.72}
        zoomSpeed={0.55}
        minPolarAngle={layout === "room" ? 0.28 : 0.36}
        maxPolarAngle={layout === "room" ? 1.38 : 1.05}
        minDistance={layout === "room" ? 1.15 : 0.32}
        maxDistance={48}
        autoRotate={layout !== "room" && state.view === "floor"}
        autoRotateSpeed={0.35}
        onStart={(e) => {
          userHold.current = true;
          const ctrl = e?.target as { autoRotate?: boolean } | undefined;
          if (ctrl) ctrl.autoRotate = false;
        }}
      />
    </>
  );
}

export function FloorStage({
  state,
  anim,
  nonce,
  reduceMotion,
  onAnimDone,
  onView,
  onSkip,
  captureApi,
  quality,
  layout = "sample",
  roomId,
  ghost = 0.58,
  evening = false,
  showRug = true,
}: {
  state: SampleState;
  anim: "lay" | "refinish" | null;
  nonce: number;
  reduceMotion: boolean;
  onAnimDone: () => void;
  onView: (view: "floor" | "closeup") => void;
  onSkip: () => void;
  captureApi: React.MutableRefObject<(() => string) | null>;
  quality: "high" | "low";
  layout?: "sample" | "room";
  roomId?: RoomId;
  ghost?: number;
  evening?: boolean;
  showRug?: boolean;
}) {
  const room = layout === "room";
  return (
    <>
      <Canvas
        key={`${layout}-${evening ? "eve" : "day"}`}
        className="stage-canvas"
        shadows={room}
        camera={{ position: room ? [3.1, 3.25, 4.15] : [2.15, 3.25, 2.25], fov: room ? 36 : 32, near: 0.05, far: 80 }}
        dpr={quality === "low" ? [1, 1.15] : [1, 1.7]}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#ffffff", 1);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = room ? (evening ? 0.78 : 1.1) : 0.92;
          gl.localClippingEnabled = true;
          gl.shadowMap.enabled = room;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <SampleScene
          state={state}
          anim={anim}
          nonce={nonce}
          reduceMotion={reduceMotion}
          onAnimDone={onAnimDone}
          captureApi={captureApi}
          layout={layout}
          roomId={roomId}
          ghost={ghost}
          evening={evening}
          showRug={showRug}
          quality={quality}
        />
      </Canvas>
      {anim && !reduceMotion && !room && (
        <button type="button" className="skip-float" onClick={onSkip}>
          Skip
        </button>
      )}
    </>
  );
}
