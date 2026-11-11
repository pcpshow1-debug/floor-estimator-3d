"use client";

import { ContactShadows, RoundedBox, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { roomProfile, type RoomId } from "@/config/rooms";
import { FurnishedRoom } from "@/components/RoomFurniture";
import { STAIR_RISER, STAIR_TREAD, type StairWell } from "@/config/stairs";
import { DOOR_H, DOOR_W, MAX_WINS, findBox, poseOf, windowCenters } from "@/lib/room-layout";

RectAreaLightUniformsLib.init();

const WALL_H = 2.72;
const WALL_T = 0.07;
const WIN_W = 1.28;
const WIN_H = 1.42;
const SILL_LIVING = 0.88;
const SILL_KITCHEN = 1.06;
type Vis = MutableRefObject<{ x: number; z: number }>;

function ghostMat(
  color: string,
  opacity: number,
  roughness = 0.86,
  extra: ConstructorParameters<typeof THREE.MeshPhysicalMaterial>[0] = {},
) {
  const solid = opacity >= 0.985;
  const faded = Math.max(0, Math.min(1, opacity));
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: extra.metalness ?? 0,
    transparent: !solid && faded < 0.999,
    opacity: solid ? 1 : faded,
    depthWrite: solid || faded > 0.42,
    envMapIntensity: extra.envMapIntensity ?? (solid ? 0.62 : 0.45),
    side: THREE.FrontSide,
    ...extra,
  });
}

function cloneMap(src: THREE.Texture, rx: number, ry: number, color = true) {
  const tex = src.clone();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.offset.set(0, 0);
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function Box({
  position = [0, 0, 0],
  size,
  material,
  cast = true,
  receive = true,
}: {
  position?: [number, number, number];
  size: [number, number, number];
  material: THREE.Material;
  cast?: boolean;
  receive?: boolean;
}) {
  return (
    <mesh position={position} castShadow={cast} receiveShadow={receive} material={material}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function SoftBox({
  position,
  size,
  material,
  radius = 0.03,
  cast = true,
}: {
  position: [number, number, number];
  size: [number, number, number];
  material: THREE.Material;
  radius?: number;
  cast?: boolean;
}) {
  return (
    <RoundedBox
      position={position}
      args={size}
      radius={Math.min(radius, size[0], size[1], size[2]) * 0.45}
      smoothness={3}
      castShadow={cast}
      receiveShadow
      material={material}
    />
  );
}

function Follow({
  vis,
  at,
  children,
}: {
  vis: Vis;
  at: (hx: number, hz: number) => [number, number, number] | { p: [number, number, number]; r?: [number, number, number] };
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const out = at(vis.current.x / 2, vis.current.z / 2);
    if (Array.isArray(out)) {
      g.position.set(out[0], out[1], out[2]);
    } else {
      g.position.set(out.p[0], out.p[1], out.p[2]);
      if (out.r) g.rotation.set(out.r[0], out.r[1], out.r[2]);
    }
  });
  return <group ref={ref}>{children}</group>;
}

function WindowUnit({
  frame,
  glass,
  sillH,
  curtains,
  w = WIN_W,
  h = WIN_H,
  showCurtains = true,
}: {
  frame: THREE.Material;
  glass: THREE.Material;
  sillH: number;
  curtains: THREE.Material;
  w?: number;
  h?: number;
  showCurtains?: boolean;
}) {
  const y = sillH + h / 2;
  return (
    <group>
      <mesh position={[0, y, 0.012]} material={glass} renderOrder={2}>
        <planeGeometry args={[w - 0.08, h - 0.08]} />
      </mesh>
      <Box position={[0, sillH + 0.03, 0.05]} size={[w + 0.12, 0.06, 0.12]} material={frame} cast={false} />
      <Box position={[0, sillH + h - 0.03, 0.04]} size={[w + 0.1, 0.06, 0.08]} material={frame} cast={false} />
      <Box position={[-(w / 2), y, 0.04]} size={[0.06, h, 0.08]} material={frame} cast={false} />
      <Box position={[w / 2, y, 0.04]} size={[0.06, h, 0.08]} material={frame} cast={false} />
      <Box position={[0, y, 0.035]} size={[0.03, h - 0.08, 0.04]} material={frame} cast={false} />
      <Box position={[0, y, 0.035]} size={[w - 0.08, 0.03, 0.04]} material={frame} cast={false} />
      <Box position={[-w / 4, y, 0.032]} size={[0.018, h - 0.1, 0.03]} material={frame} cast={false} />
      <Box position={[w / 4, y, 0.032]} size={[0.018, h - 0.1, 0.03]} material={frame} cast={false} />
      {showCurtains && <Box position={[0, sillH + h + 0.05, 0.09]} size={[w + 0.62, 0.028, 0.028]} material={frame} cast={false} />}
      {showCurtains && [-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 + 0.12), 0, 0.1]}>
          {Array.from({ length: 8 }, (_, i) => {
            const wave = Math.sin(i * 0.7) * 0.018;
            return (
              <mesh
                key={i}
                position={[side * (0.01 + i * 0.012), sillH + (h + 0.22) / 2 - 0.02, 0.01 + wave]}
                rotation={[0, side * 0.12, 0.03 * Math.sin(i * 0.9)]}
                material={curtains}
                castShadow
              >
                <boxGeometry args={[0.09, h + 0.28, 0.022]} />
              </mesh>
            );
          })}
        </group>
      ))}
<spotLight position={[0, y, 0.08]} color="#ffe6b0" intensity={1.15} distance={5.5} angle={0.42} penumbra={0.9} decay={2} />
    </group>
  );
}

function Architecture({
  vis,
  kind,
  wall,
  frame,
  glass,
  curtains,
  wood,
  evening = false,
}: {
  vis: Vis;
  kind: RoomId;
  wall: THREE.Material;
  frame: THREE.Material;
  glass: THREE.Material;
  curtains: THREE.Material;
  wood: THREE.Material;
  evening?: boolean;
}) {
  const profile = roomProfile(kind);
  const sillH = profile.sill;
  const winW = profile.winW;
  const winH = profile.winH;
  const wallH = profile.wallH;
  const left = useRef<THREE.Mesh>(null);
  const rightBack = useRef<THREE.Mesh>(null);
  const rightFront = useRef<THREE.Mesh>(null);
  const header = useRef<THREE.Mesh>(null);
  const under = useRef<THREE.Mesh>(null);
  const over = useRef<THREE.Mesh>(null);
  const fillL = useRef<THREE.Mesh>(null);
  const fillR = useRef<THREE.Mesh>(null);
  const mids = useRef<(THREE.Mesh | null)[]>([]);
  const wins = useRef<(THREE.Group | null)[]>([]);
  const door = useRef<THREE.Group>(null);
  const baseL = useRef<THREE.Mesh>(null);
  const baseR = useRef<THREE.Mesh>(null);
  const baseB = useRef<THREE.Mesh>(null);
  const crownL = useRef<THREE.Mesh>(null);
  const crownR = useRef<THREE.Mesh>(null);
  const crownB = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const wash = useRef<THREE.RectAreaLight>(null);
  const innerX = useRef<THREE.Mesh>(null);
  const innerZ = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const sx = vis.current.x;
    const sz = vis.current.z;
    const hx = sx / 2;
    const hz = sz / 2;
    const xs = windowCenters(sx, winW, profile.minWindows, profile.maxWindows);
    const first = xs.length ? xs[0] - winW / 2 : -sx / 2;
    const last = xs.length ? xs[xs.length - 1] + winW / 2 : sx / 2;
    const midY = sillH + winH / 2;

    if (left.current) {
      left.current.visible = false;
    }
    const doorZ = hz - 0.58;
    const d0 = doorZ - DOOR_W / 2;
    const d1 = doorZ + DOOR_W / 2;
    const backLen = Math.max(0.2, d0 + hz);
    const frontLen = Math.max(0.12, hz - d1);
    if (rightBack.current) {
      rightBack.current.position.set(-hx - WALL_T / 2, wallH / 2, -hz + backLen / 2);
      rightBack.current.scale.set(1, 1, backLen);
    }
    if (rightFront.current) {
      rightFront.current.position.set(-hx - WALL_T / 2, wallH / 2, d1 + frontLen / 2);
      rightFront.current.scale.set(1, 1, frontLen);
    }
    if (header.current) {
      header.current.position.set(-hx - WALL_T / 2, DOOR_H + (wallH - DOOR_H) / 2, doorZ);
      header.current.scale.set(1, 1, DOOR_W + 0.04);
    }
    if (door.current) door.current.position.set(-hx + 0.025, 0, doorZ);
    if (profile.leftCover < 0.8) {
      if (rightFront.current) rightFront.current.visible = false;
      if (door.current) door.current.visible = false;
      if (header.current) header.current.visible = false;
      if (rightBack.current) {
        const cover = Math.max(0.4, sz * profile.leftCover);
        rightBack.current.position.set(-hx - WALL_T / 2, wallH / 2, -hz + cover / 2);
        rightBack.current.scale.set(1, 1, cover);
        rightBack.current.visible = true;
      }
    }
    if (profile.lShape) {
      const cutX = -hx + sx * 0.55;
      const cutZ = -hz + sz * 0.44;
      if (innerX.current) innerX.current.visible = false;
      if (innerZ.current) {
        const len = 0.38;
        innerZ.current.visible = true;
        innerZ.current.position.set(cutX + len / 2, 0.46, cutZ);
        innerZ.current.scale.set(len, 0.34, 1);
      }
    } else {
      if (innerX.current) innerX.current.visible = false;
      if (innerZ.current) innerZ.current.visible = false;
    }

    if (under.current) {
      under.current.position.set(0, sillH / 2, -hz - WALL_T / 2);
      under.current.scale.set(sx + WALL_T * 2, 1, 1);
    }
    const overH = Math.max(0.16, wallH - sillH - winH);
    if (over.current) {
      over.current.position.set(0, sillH + winH + overH / 2, -hz - WALL_T / 2);
      over.current.scale.set(sx + WALL_T * 2, 1, 1);
    }
    if (fillL.current) {
      const w = Math.max(0.12, first + hx);
      fillL.current.position.set(-hx + w / 2, midY, -hz - WALL_T / 2);
      fillL.current.scale.set(w, 1, 1);
    }
    if (fillR.current) {
      const w = Math.max(0.12, hx - last);
      fillR.current.position.set(hx - w / 2, midY, -hz - WALL_T / 2);
      fillR.current.scale.set(w, 1, 1);
    }
    for (let i = 0; i < MAX_WINS; i++) {
      const g = wins.current[i];
      if (g) {
        g.visible = i < xs.length;
        if (i < xs.length) g.position.set(xs[i], 0, -hz);
      }
      const mid = mids.current[i];
      if (mid) {
        const show = i < xs.length - 1;
        mid.visible = show;
        if (show) {
          const a = xs[i] + winW / 2;
          const b = xs[i + 1] - winW / 2;
          const w = Math.max(0.08, b - a);
          mid.position.set((a + b) / 2, midY, -hz - WALL_T / 2);
          mid.scale.set(w, 1, 1);
        }
      }
    }

    if (baseL.current) {
      baseL.current.position.set(-hx + 0.018, 0.05, 0);
      baseL.current.scale.set(1, 1, sz);
    }
    if (baseR.current) {
      baseR.current.visible = false;
    }
    if (baseB.current) {
      baseB.current.position.set(0, 0.05, -hz + 0.018);
      baseB.current.scale.set(sx, 1, 1);
    }
    if (crownL.current) {
      crownL.current.position.set(-hx + 0.02, wallH - 0.035, 0);
      crownL.current.scale.set(1, 1, sz);
    }
    if (crownR.current) {
      crownR.current.visible = false;
    }
    if (crownB.current) {
      crownB.current.position.set(0, wallH - 0.035, -hz + 0.02);
      crownB.current.scale.set(sx, 1, 1);
    }
    if (sun.current) {
      sun.current.position.set(sx * 0.04, 4.15, -hz - 2.5);
      const ext = Math.max(sx, sz) * 0.9 + 1.4;
      const cam = sun.current.shadow.camera as THREE.OrthographicCamera;
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext;
      cam.bottom = -ext;
      cam.updateProjectionMatrix();
    }
    if (wash.current) {
      wash.current.position.set(0, sillH + winH / 2, -hz + 0.05);
      wash.current.width = Math.min(sx - 0.5, xs.length * winW + 0.4);
    }
  });

  return (
    <group>
      <hemisphereLight args={evening ? ["#3d3550", "#1b1410", 0.28] : ["#ffe4bc", "#b99774", 0.46]} />
      <directionalLight
        ref={sun}
        intensity={evening ? 0.28 : 2.2}
        color={evening ? "#ff9a4a" : "#fff1d6"}
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-bias={-0.0003}
        shadow-normalBias={0.032}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      <directionalLight position={[2.4, 2.8, 1.6]} intensity={0.18} color="#fff0d2" />
      <rectAreaLight ref={wash} rotation={[0, Math.PI, 0]} height={winH} intensity={evening ? 1.35 : 8.2} color={evening ? "#ffb070" : "#fff4dc"} />

      <mesh ref={left} material={wall} receiveShadow>
        <boxGeometry args={[WALL_T, wallH, 1]} />
      </mesh>
      <mesh ref={rightBack} material={wall} receiveShadow>
        <boxGeometry args={[WALL_T, wallH, 1]} />
      </mesh>
      <mesh ref={rightFront} material={wall} receiveShadow>
        <boxGeometry args={[WALL_T, wallH, 1]} />
      </mesh>
      <mesh ref={header} material={wall} receiveShadow>
        <boxGeometry args={[WALL_T, wallH - DOOR_H, 1]} />
      </mesh>
      <mesh ref={under} material={wall} receiveShadow>
        <boxGeometry args={[1, sillH, WALL_T]} />
      </mesh>
      <mesh ref={over} material={wall} receiveShadow>
        <boxGeometry args={[1, Math.max(0.16, wallH - sillH - winH), WALL_T]} />
      </mesh>
      <mesh ref={fillL} material={wall} receiveShadow>
        <boxGeometry args={[1, winH, WALL_T]} />
      </mesh>
      <mesh ref={fillR} material={wall} receiveShadow>
        <boxGeometry args={[1, winH, WALL_T]} />
      </mesh>
      {Array.from({ length: MAX_WINS }, (_, i) => (
        <mesh key={`mid-${i}`} ref={(el) => { mids.current[i] = el; }} material={wall} receiveShadow>
          <boxGeometry args={[1, winH, WALL_T]} />
        </mesh>
      ))}
      {Array.from({ length: MAX_WINS }, (_, i) => (
        <group key={`win-${i}`} ref={(el) => { wins.current[i] = el; }}>
          <WindowUnit frame={frame} glass={glass} sillH={sillH} curtains={curtains} w={winW} h={winH} showCurtains={profile.curtains} />
        </group>
      ))}

      <group ref={door}>
        <Box position={[0, DOOR_H / 2, 0]} size={[0.05, DOOR_H, DOOR_W - 0.04]} material={wood} />
        <Box position={[0, DOOR_H * 0.72, 0.012]} size={[0.02, 0.72, 0.62]} material={frame} cast={false} />
        <Box position={[0, DOOR_H * 0.28, 0.012]} size={[0.02, 0.62, 0.62]} material={frame} cast={false} />
        <Box position={[0, DOOR_H / 2, -DOOR_W / 2 - 0.03]} size={[0.08, DOOR_H + 0.06, 0.07]} material={frame} cast={false} />
        <Box position={[0, DOOR_H / 2, DOOR_W / 2 + 0.03]} size={[0.08, DOOR_H + 0.06, 0.07]} material={frame} cast={false} />
        <Box position={[0, DOOR_H + 0.03, 0]} size={[0.08, 0.07, DOOR_W + 0.14]} material={frame} cast={false} />
        <mesh position={[0.03, 1.02, 0.32]} material={frame}>
          <sphereGeometry args={[0.028, 12, 12]} />
        </mesh>
      </group>

      <mesh ref={innerX} material={wall} receiveShadow visible={false}>
        <boxGeometry args={[WALL_T, wallH, 1]} />
      </mesh>
      <mesh ref={innerZ} material={wall} receiveShadow visible={false}>
        <boxGeometry args={[1, wallH, WALL_T]} />
      </mesh>
      <mesh ref={baseL} material={frame}><boxGeometry args={[0.036, 0.1, 1]} /></mesh>
      <mesh ref={baseR} material={frame}><boxGeometry args={[0.036, 0.1, 1]} /></mesh>
      <mesh ref={baseB} material={frame}><boxGeometry args={[1, 0.1, 0.036]} /></mesh>
      <mesh ref={crownL} material={frame}><boxGeometry args={[0.05, 0.07, 1]} /></mesh>
      <mesh ref={crownR} material={frame}><boxGeometry args={[0.05, 0.07, 1]} /></mesh>
      <mesh ref={crownB} material={frame}><boxGeometry args={[1, 0.07, 0.05]} /></mesh>
    </group>
  );
}

function Sofa({ fabric, wood }: { fabric: THREE.Material; wood: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.22, 0.02]} size={[2.16, 0.2, 0.84]} material={fabric} radius={0.05} />
      <SoftBox position={[-0.52, 0.4, 0.06]} size={[0.96, 0.16, 0.7]} material={fabric} radius={0.05} />
      <SoftBox position={[0.52, 0.4, 0.06]} size={[0.96, 0.16, 0.7]} material={fabric} radius={0.05} />
      <SoftBox position={[0, 0.62, -0.3]} size={[2.14, 0.5, 0.22]} material={fabric} radius={0.06} />
      <SoftBox position={[-0.5, 0.68, -0.28]} size={[0.92, 0.38, 0.16]} material={fabric} radius={0.05} />
      <SoftBox position={[0.5, 0.68, -0.28]} size={[0.92, 0.38, 0.16]} material={fabric} radius={0.05} />
      <SoftBox position={[-1.02, 0.42, 0.02]} size={[0.18, 0.52, 0.86]} material={fabric} radius={0.05} />
      <SoftBox position={[1.02, 0.42, 0.02]} size={[0.18, 0.52, 0.86]} material={fabric} radius={0.05} />
      {[
        [-0.92, -0.32],
        [0.92, -0.32],
        [-0.92, 0.32],
        [0.92, 0.32],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} material={wood} castShadow>
          <cylinderGeometry args={[0.028, 0.034, 0.14, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function Armchair({ fabric, wood }: { fabric: THREE.Material; wood: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.22, 0]} size={[0.78, 0.18, 0.76]} material={fabric} radius={0.05} />
      <SoftBox position={[0, 0.38, 0.02]} size={[0.7, 0.14, 0.62]} material={fabric} radius={0.045} />
      <SoftBox position={[0, 0.58, -0.28]} size={[0.76, 0.48, 0.18]} material={fabric} radius={0.05} />
      <SoftBox position={[-0.36, 0.4, 0]} size={[0.14, 0.46, 0.74]} material={fabric} radius={0.04} />
      <SoftBox position={[0.36, 0.4, 0]} size={[0.14, 0.46, 0.74]} material={fabric} radius={0.04} />
      {[
        [-0.28, -0.26],
        [0.28, -0.26],
        [-0.28, 0.26],
        [0.28, 0.26],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.065, z]} material={wood} castShadow>
          <cylinderGeometry args={[0.022, 0.028, 0.13, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function CoffeeTable({ wood, stone }: { wood: THREE.Material; stone: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.34, 0]} size={[1.12, 0.04, 0.58]} material={stone} radius={0.016} />
      <SoftBox position={[0, 0.3, 0]} size={[1.06, 0.035, 0.52]} material={wood} radius={0.012} />
      {[
        [-0.44, -0.2],
        [0.44, -0.2],
        [-0.44, 0.2],
        [0.44, 0.2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.15, z]} material={wood} castShadow>
          <boxGeometry args={[0.045, 0.3, 0.045]} />
        </mesh>
      ))}
    </group>
  );
}

function SideTable({ wood, stone }: { wood: THREE.Material; stone: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.48, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.035, 20]} />
      </mesh>
      <mesh position={[0, 0.26, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.42, 12]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.03, 20]} />
      </mesh>
    </group>
  );
}

function FloorLamp({ metal, shade }: { metal: THREE.Material; shade: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} material={metal} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.04, 16]} />
      </mesh>
      <mesh position={[0, 0.78, 0]} material={metal} castShadow>
        <cylinderGeometry args={[0.016, 0.02, 1.48, 10]} />
      </mesh>
      <mesh position={[0, 1.58, 0]} rotation={[0.15, 0, 0.08]} material={shade} castShadow>
        <coneGeometry args={[0.18, 0.28, 16, 1, true]} />
      </mesh>
      <mesh position={[0, 1.52, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color="#fff4d6" transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, 1.48, 0]} color="#ffd89a" intensity={1.8} distance={4.8} decay={2} />
    </group>
  );
}

function Plant({ pot, leaf, dirt }: { pot: THREE.Material; leaf: THREE.Material; dirt: THREE.Material }) {
  const leaves = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.18;
    const h = 0.42 + (i % 5) * 0.07;
    const r = 0.055 + (i % 4) * 0.012;
    return { a, h, r, tilt: 0.7 + (i % 4) * 0.1 };
  });
  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={pot} castShadow>
        <cylinderGeometry args={[0.125, 0.1, 0.26, 16]} />
      </mesh>
      <mesh position={[0, 0.29, 0]} material={dirt}>
        <cylinderGeometry args={[0.112, 0.112, 0.035, 16]} />
      </mesh>
      {leaves.map((L, i) => (
        <group key={i} rotation={[0, L.a, 0]}>
          <mesh position={[0.015, 0.3 + L.h * 0.32, 0]} rotation={[0.2, 0, 0.1]} material={leaf}>
            <cylinderGeometry args={[0.005, 0.008, L.h * 0.62, 6]} />
          </mesh>
          <mesh position={[0.08, 0.34 + L.h, 0]} rotation={[L.tilt, 0.25, 1.2]} scale={[1.85, 0.16, 1]} material={leaf} castShadow>
            <sphereGeometry args={[L.r, 9, 7]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Artwork({ frame, canvas, accent }: { frame: THREE.Material; canvas: THREE.Material; accent: THREE.Material }) {
  return (
    <group>
      <Box position={[0, 0, -0.01]} size={[0.74, 0.55, 0.03]} material={frame} cast={false} />
      <Box position={[0, 0, 0.01]} size={[0.64, 0.45, 0.012]} material={canvas} cast={false} />
      <Box position={[-0.13, 0.06, 0.02]} size={[0.22, 0.18, 0.01]} material={accent} cast={false} />
      <Box position={[0.14, -0.05, 0.02]} size={[0.18, 0.15, 0.01]} material={frame} cast={false} />
    </group>
  );
}

function Shelves({ wood, metal, bookA, bookB, bookC }: { wood: THREE.Material; metal: THREE.Material; bookA: THREE.Material; bookB: THREE.Material; bookC: THREE.Material }) {
  const books = [bookA, bookB, bookC];
  return (
    <group>
      {[-0.42, 0.42].map((x) => (
        <Box key={x} position={[x, 0.7, 0]} size={[0.03, 1.28, 0.03]} material={metal} />
      ))}
      {[0.22, 0.66, 1.1].map((y, row) => (
        <group key={y}>
          <SoftBox position={[0, y, 0.08]} size={[0.92, 0.03, 0.26]} material={wood} radius={0.008} />
          {Array.from({ length: 5 }, (_, i) => (
            <Box
              key={i}
              position={[-0.32 + i * 0.14, y + 0.12 + (i % 3) * 0.015, 0.06]}
              size={[0.06, 0.18 + (i % 3) * 0.03, 0.16]}
              material={books[i % 3]}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function CabinetRun({
  width,
  stone,
  body,
  handle,
  tile,
  includeOven,
  sink,
}: {
  width: number;
  stone: THREE.Material;
  body: THREE.Material;
  handle: THREE.Material;
  tile: THREE.Material;
  includeOven?: boolean;
  sink?: boolean;
}) {
  const unit = 0.58;
  const n = Math.max(2, Math.floor(width / unit));
  const run = n * unit;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const x = -run / 2 + unit / 2 + i * unit;
        const oven = Boolean(includeOven && i === Math.max(0, n - 2));
        return (
          <group key={i} position={[x, 0, 0]}>
            <SoftBox position={[0, 0.44, 0]} size={[unit - 0.02, 0.84, 0.56]} material={body} radius={0.018} />
            <Box position={[0, oven ? 0.38 : 0.42, 0.29]} size={[unit - 0.1, oven ? 0.52 : 0.68, 0.02]} material={oven ? handle : body} />
            {!oven && <Box position={[unit * 0.16, 0.62, 0.31]} size={[0.1, 0.014, 0.02]} material={handle} />}
            {oven && <Box position={[0, 0.18, 0.3]} size={[unit - 0.16, 0.08, 0.02]} material={handle} />}
          </group>
        );
      })}
      <SoftBox position={[0, 0.9, 0.02]} size={[run + 0.06, 0.045, 0.62]} material={stone} radius={0.012} />
      <Box position={[0, 1.12, -0.26]} size={[run, 0.42, 0.02]} material={tile} cast={false} />
      {sink && <SoftBox position={[0, 0.905, 0.04]} size={[0.42, 0.02, 0.36]} material={handle} radius={0.02} />}
      {n >= 3 &&
        Array.from({ length: n }, (_, i) => {
          if (i === Math.floor((n - 1) / 2) || i === Math.ceil(n / 2)) return null;
          const x = -run / 2 + unit / 2 + i * unit;
          return (
            <group key={`up-${i}`} position={[x, 1.78, -0.04]}>
              <SoftBox position={[0, 0, 0]} size={[unit - 0.03, 0.7, 0.34]} material={body} radius={0.016} />
              <Box position={[0, 0.02, 0.175]} size={[unit - 0.1, 0.56, 0.018]} material={body} />
              <Box position={[unit * 0.16, 0.08, 0.19]} size={[0.09, 0.012, 0.016]} material={handle} />
            </group>
          );
        })}
    </group>
  );
}

function Island({ stone, body, wood }: { stone: THREE.Material; body: THREE.Material; wood: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.42, 0]} size={[1.72, 0.8, 0.86]} material={body} radius={0.03} />
      <SoftBox position={[0, 0.9, 0]} size={[1.82, 0.045, 0.94]} material={stone} radius={0.014} />
      <Box position={[0.72, 0.55, 0.44]} size={[0.12, 0.016, 0.02]} material={wood} />
    </group>
  );
}

function Stool({ wood, metal }: { wood: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.16, 0.17, 0.045, 16]} />
      </mesh>
      <mesh position={[0, 0.32, 0]} material={metal} castShadow>
        <cylinderGeometry args={[0.018, 0.022, 0.58, 10]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal}>
        <torusGeometry args={[0.15, 0.012, 8, 20]} />
      </mesh>
      <mesh position={[0, 0.03, 0]} material={metal}>
        <cylinderGeometry args={[0.14, 0.14, 0.03, 16]} />
      </mesh>
    </group>
  );
}

function Pendant({ metal, glass }: { metal: THREE.Material; glass: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} material={metal}>
        <cylinderGeometry args={[0.008, 0.008, 0.56, 8]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={glass} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.14, 16]} />
      </mesh>
      <pointLight position={[0, -0.04, 0]} color="#ffd89a" intensity={2.4} distance={5.2} decay={2} />
    </group>
  );
}

function Fridge({ body, metal }: { body: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.92, 0]} size={[0.72, 1.82, 0.68]} material={body} radius={0.03} />
      <Box position={[-0.37, 1.15, 0.12]} size={[0.02, 0.42, 0.02]} material={metal} />
      <Box position={[-0.37, 0.42, 0.12]} size={[0.02, 0.36, 0.02]} material={metal} />
      <Box position={[0, 0.92, 0.345]} size={[0.66, 0.012, 0.01]} material={metal} cast={false} />
    </group>
  );
}


function Chandelier({ metal, glass, lit = true }: { metal: THREE.Material; glass: THREE.Material; lit?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={metal}><cylinderGeometry args={[0.007, 0.007, 0.28, 8]} /></mesh>
      <mesh position={[0, 0.03, 0]} material={metal}><torusGeometry args={[0.11, 0.01, 8, 24]} /></mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
          <mesh position={[0.11, -0.045, 0]} material={glass} castShadow>
            <sphereGeometry args={[0.024, 12, 12]} />
          </mesh>
        </group>
      ))}
      {lit && <pointLight position={[0, -0.04, 0]} color="#ffd299" intensity={2.15} distance={6.2} decay={2} />}
    </group>
  );
}

function DiningTable({ wood, stone, seats }: { wood: THREE.Material; stone: THREE.Material; seats: number }) {
  const len = seats >= 8 ? 2.2 : seats >= 6 ? 1.8 : 1.45;
  return (
    <group>
      <SoftBox position={[0, 0.74, 0]} size={[len, 0.04, 0.9]} material={stone} radius={0.015} />
      <SoftBox position={[0, 0.7, 0]} size={[len - 0.06, 0.03, 0.84]} material={wood} radius={0.01} />
      {[[-len / 2 + 0.12, -0.32], [len / 2 - 0.12, -0.32], [-len / 2 + 0.12, 0.32], [len / 2 - 0.12, 0.32]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.36, z]} material={wood} castShadow>
          <boxGeometry args={[0.06, 0.7, 0.06]} />
        </mesh>
      ))}
    </group>
  );
}

function DiningChair({ fabric, wood }: { fabric: THREE.Material; wood: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.46, 0]} size={[0.42, 0.06, 0.42]} material={wood} radius={0.02} />
      <SoftBox position={[0, 0.5, 0]} size={[0.4, 0.05, 0.4]} material={fabric} radius={0.02} />
      <SoftBox position={[0, 0.78, -0.18]} size={[0.4, 0.46, 0.06]} material={fabric} radius={0.02} />
      {[[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]} material={wood}><cylinderGeometry args={[0.018, 0.02, 0.44, 8]} /></mesh>
      ))}
    </group>
  );
}

function Bed({ fabric, wood, king }: { fabric: THREE.Material; wood: THREE.Material; king?: boolean }) {
  const w = king ? 1.92 : 1.52;
  const d = king ? 2.05 : 2.0;
  return (
    <group>
      <SoftBox position={[0, 0.28, 0]} size={[w + 0.08, 0.22, d + 0.06]} material={wood} radius={0.03} />
      <SoftBox position={[0, 0.46, 0.02]} size={[w, 0.2, d]} material={fabric} radius={0.04} />
      <SoftBox position={[0, 0.72, -d / 2 + 0.05]} size={[w + 0.1, 0.7, 0.1]} material={wood} radius={0.03} />
      <SoftBox position={[-w * 0.22, 0.62, -d / 2 + 0.22]} size={[w * 0.36, 0.14, 0.28]} material={fabric} radius={0.05} />
      <SoftBox position={[w * 0.22, 0.62, -d / 2 + 0.22]} size={[w * 0.36, 0.14, 0.28]} material={fabric} radius={0.05} />
    </group>
  );
}

function Nightstand({ wood, stone }: { wood: THREE.Material; stone: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.28, 0]} size={[0.46, 0.48, 0.4]} material={wood} radius={0.02} />
      <SoftBox position={[0, 0.53, 0]} size={[0.5, 0.04, 0.44]} material={stone} radius={0.012} />
    </group>
  );
}

function Dresser({ wood, metal }: { wood: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.42, 0]} size={[1.2, 0.82, 0.46]} material={wood} radius={0.025} />
      {[0.22, 0.0, -0.2].map((y, i) => (
        <Box key={i} position={[0, 0.42 + y, 0.23]} size={[1.06, 0.18, 0.02]} material={wood} />
      ))}
      <Box position={[0, 0.58, 0.25]} size={[0.12, 0.014, 0.02]} material={metal} />
    </group>
  );
}

function Desk({ wood, stone }: { wood: THREE.Material; stone: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.74, 0]} size={[1.45, 0.04, 0.68]} material={stone} radius={0.012} />
      <SoftBox position={[-0.58, 0.36, 0]} size={[0.22, 0.7, 0.62]} material={wood} radius={0.02} />
      <SoftBox position={[0.58, 0.36, 0]} size={[0.22, 0.7, 0.62]} material={wood} radius={0.02} />
    </group>
  );
}

function OfficeChair({ fabric, metal }: { fabric: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.52, 0]} size={[0.5, 0.08, 0.5]} material={fabric} radius={0.04} />
      <SoftBox position={[0, 0.82, -0.18]} size={[0.48, 0.5, 0.08]} material={fabric} radius={0.04} />
      <mesh position={[0, 0.28, 0]} material={metal}><cylinderGeometry args={[0.03, 0.03, 0.4, 8]} /></mesh>
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal}><torusGeometry args={[0.22, 0.016, 8, 16]} /></mesh>
    </group>
  );
}

function Vanity({ body, stone, metal }: { body: THREE.Material; stone: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.38, 0]} size={[1.15, 0.72, 0.5]} material={body} radius={0.02} />
      <SoftBox position={[0, 0.76, 0.02]} size={[1.22, 0.04, 0.56]} material={stone} radius={0.012} />
      <mesh position={[0, 0.8, 0.04]} material={metal}><cylinderGeometry args={[0.14, 0.14, 0.04, 16]} /></mesh>
      <Box position={[0, 1.42, -0.22]} size={[0.72, 0.72, 0.03]} material={metal} />
    </group>
  );
}

function Toilet({ body }: { body: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0.02]} material={body} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.38, 16]} />
      </mesh>
      <SoftBox position={[0, 0.58, -0.16]} size={[0.4, 0.42, 0.18]} material={body} radius={0.04} />
      <SoftBox position={[0, 0.42, 0.04]} size={[0.38, 0.06, 0.42]} material={body} radius={0.03} />
    </group>
  );
}

function Tub({ body, metal }: { body: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.28, 0]} size={[1.55, 0.52, 0.72]} material={body} radius={0.08} />
      <SoftBox position={[0, 0.42, 0]} size={[1.38, 0.08, 0.56]} material={metal} radius={0.04} />
    </group>
  );
}

function Bench({ wood, fabric }: { wood: THREE.Material; fabric: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.42, 0]} size={[1.05, 0.08, 0.4]} material={fabric} radius={0.03} />
      <SoftBox position={[0, 0.2, 0]} size={[1.0, 0.08, 0.36]} material={wood} radius={0.02} />
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} material={wood}><boxGeometry args={[0.06, 0.4, 0.34]} /></mesh>
      ))}
    </group>
  );
}

function Console({ wood, stone }: { wood: THREE.Material; stone: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.76, 0]} size={[1.15, 0.04, 0.36]} material={stone} radius={0.012} />
      <SoftBox position={[0, 0.48, 0]} size={[1.08, 0.5, 0.32]} material={wood} radius={0.02} />
    </group>
  );
}

function WasherDryer({ body, metal }: { body: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      {[-0.38, 0.38].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <SoftBox position={[0, 0.48, 0]} size={[0.68, 0.92, 0.64]} material={body} radius={0.03} />
          <mesh position={[0, 0.52, 0.33]} material={metal}><cylinderGeometry args={[0.2, 0.2, 0.04, 20]} /></mesh>
          <Box position={[0, 0.88, 0.3]} size={[0.42, 0.08, 0.04]} material={metal} />
        </group>
      ))}
    </group>
  );
}


function Rug({ fabric, w = 2.45, d = 1.7 }: { fabric: THREE.Material; w?: number; d?: number }) {
  return (
    <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]} material={fabric} receiveShadow>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

function Chaise({ fabric, wood }: { fabric: THREE.Material; wood: THREE.Material }) {
  return (
    <group>
      <SoftBox position={[0, 0.22, 0]} size={[0.92, 0.2, 1.42]} material={fabric} radius={0.05} />
      <SoftBox position={[0, 0.4, -0.12]} size={[0.82, 0.16, 1.12]} material={fabric} radius={0.05} />
      <SoftBox position={[0, 0.62, -0.58]} size={[0.9, 0.5, 0.22]} material={fabric} radius={0.06} />
      <SoftBox position={[-0.38, 0.42, 0]} size={[0.16, 0.5, 1.38]} material={fabric} radius={0.05} />
      {[[-0.32, -0.58], [0.32, -0.58], [-0.32, 0.58], [0.32, 0.58]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.08, z]} material={wood}><cylinderGeometry args={[0.03, 0.034, 0.16, 8]} /></mesh>
      ))}
    </group>
  );
}

function Fireplace({ stone, wood, hearth, screen }: { stone: THREE.Material; wood: THREE.Material; hearth: THREE.Material; screen: THREE.Material }) {
  return (
    <group>
      <Box position={[0, 0.58, 0]} size={[1.42, 1.16, 0.32]} material={stone} />
      <Box position={[0, 0.46, 0.1]} size={[0.74, 0.68, 0.16]} material={hearth} />
      <Box position={[0, 1.18, 0.06]} size={[1.58, 0.07, 0.4]} material={wood} />
      <Box position={[0, 0.06, 0.16]} size={[1.5, 0.1, 0.42]} material={stone} />
      <Box position={[0, 1.68, 0.01]} size={[1.22, 0.72, 0.03]} material={wood} />
      <Box position={[0, 1.68, 0.03]} size={[1.16, 0.66, 0.04]} material={screen} />
    </group>
  );
}

function ShowerGlass({ glass, metal }: { glass: THREE.Material; metal: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 1.05, 0]} material={glass}><boxGeometry args={[0.03, 2.05, 0.92]} /></mesh>
      <Box position={[0, 2.08, 0]} size={[0.04, 0.03, 0.94]} material={metal} />
      <Box position={[0, 0.04, 0]} size={[0.04, 0.04, 0.94]} material={metal} />
    </group>
  );
}

function CoatHooks({ metal }: { metal: THREE.Material }) {
  return (
    <group>
      {[-0.18, 0, 0.18].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]} material={metal}>
          <cylinderGeometry args={[0.012, 0.012, 0.08, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function StairRail({ wood, metal, paint, well }: { wood: THREE.Material; metal: THREE.Material; paint: THREE.Material; well: StairWell }) {
  const posts: ReactNode[] = [];
  const rails: ReactNode[] = [];
  well.flights.forEach((fl, fi) => {
    for (let i = 0; i < fl.nTreads; i++) {
      const y = fl.y0 + i * STAIR_RISER;
      if (fl.dir === "negZ") {
        const z = fl.z - i * STAIR_TREAD;
        rails.push(
          <group key={`${fi}-r-${i}`}>
            <Box position={[fl.x, y + STAIR_RISER / 2, z + STAIR_TREAD / 2 - 0.006]} size={[fl.width + 0.05, STAIR_RISER, 0.032]} material={paint} />
            <mesh position={[fl.x + fl.width / 2 - 0.045, y + STAIR_RISER + 0.46, z]} material={metal}>
              <cylinderGeometry args={[0.02, 0.02, 0.92, 10]} />
            </mesh>
          </group>,
        );
      } else {
        const x = fl.x + i * STAIR_TREAD;
        rails.push(
          <group key={`${fi}-r-${i}`}>
            <Box position={[x - STAIR_TREAD / 2 + 0.006, y + STAIR_RISER / 2, fl.z]} size={[0.032, STAIR_RISER, fl.width + 0.05]} material={paint} />
            <mesh position={[x, y + STAIR_RISER + 0.46, fl.z + fl.width / 2 - 0.045]} material={metal}>
              <cylinderGeometry args={[0.02, 0.02, 0.92, 10]} />
            </mesh>
          </group>,
        );
      }
    }
    const rise = fl.nTreads * STAIR_RISER;
    const midY = fl.y0 + rise / 2;
    if (fl.dir === "negZ") {
      const midZ = fl.z - ((fl.nTreads - 1) * STAIR_TREAD) / 2;
      const angle = Math.atan(STAIR_RISER / STAIR_TREAD);
      const hyp = fl.nTreads * Math.hypot(STAIR_TREAD, STAIR_RISER);
      rails.push(
        <group key={`${fi}-str`}>
          <mesh position={[fl.x + fl.width / 2 + 0.02, midY + 0.04, midZ]} rotation={[angle, 0, 0]} material={wood} castShadow>
            <boxGeometry args={[0.05, 0.24, hyp + 0.08]} />
          </mesh>
          <mesh position={[fl.x - fl.width / 2 - 0.02, midY + 0.04, midZ]} rotation={[angle, 0, 0]} material={wood} castShadow>
            <boxGeometry args={[0.05, 0.24, hyp + 0.08]} />
          </mesh>
          <mesh position={[fl.x + fl.width / 2 - 0.045, midY + 0.96, midZ]} rotation={[angle, 0, 0]} material={wood} castShadow>
            <boxGeometry args={[0.058, 0.046, hyp + 0.05]} />
          </mesh>
        </group>,
      );
      posts.push(<Box key={`${fi}-n0`} position={[fl.x + fl.width / 2 - 0.045, fl.y0 + 0.52, fl.z + STAIR_TREAD * 0.3]} size={[0.09, 1.04, 0.09]} material={wood} />);
    } else {
      const midX = fl.x + ((fl.nTreads - 1) * STAIR_TREAD) / 2;
      const angle = Math.atan(STAIR_RISER / STAIR_TREAD);
      const hyp = fl.nTreads * Math.hypot(STAIR_TREAD, STAIR_RISER);
      rails.push(
        <group key={`${fi}-str`}>
          <mesh position={[midX, midY + 0.04, fl.z + fl.width / 2 + 0.02]} rotation={[0, 0, -angle]} material={wood} castShadow>
            <boxGeometry args={[hyp + 0.08, 0.24, 0.05]} />
          </mesh>
          <mesh position={[midX, midY + 0.96, fl.z + fl.width / 2 - 0.045]} rotation={[0, 0, -angle]} material={wood} castShadow>
            <boxGeometry args={[hyp + 0.05, 0.046, 0.058]} />
          </mesh>
        </group>,
      );
    }
  });
  posts.push(<Box key="land-newel" position={[well.landingPos[0] + well.landingSize[0] / 2 - 0.06, well.landingPos[1] + 0.48, well.landingPos[2]]} size={[0.09, 0.96, 0.09]} material={wood} />);
  return (
    <group>
      {rails}
      {posts}
      <Box position={[well.landingPos[0] + well.landingSize[0] / 2 - 0.04, well.landingPos[1] + 0.92, well.landingPos[2]]} size={[0.055, 0.04, well.landingSize[1]]} material={wood} />
    </group>
  );
}

export function RoomShell({
  kind,
  spanX,
  spanZ,
  ghost,
  vis,
  stairWell = null,
  evening = false,
  showRug = true,
}: {
  kind: RoomId;
  spanX: number;
  spanZ: number;
  ghost: number;
  vis: Vis;
  stairWell?: StairWell | null;
  evening?: boolean;
  showRug?: boolean;
}) {
  const profile = roomProfile(kind);
  const opacity = Math.min(1, Math.max(0, ghost));
  const maps = useTexture({
    wood: "/textures/maple/color.webp",
    woodN: "/textures/maple/normal.webp",
    woodR: "/textures/maple/rough.webp",
    stone: "/textures/calacatta/color.webp",
    stoneN: "/textures/calacatta/normal.webp",
    tile: "/textures/subway/color.webp",
    tileN: "/textures/subway/normal.webp",
    wallN: "/textures/cement/normal.webp",
    pot: "/textures/terracotta/color.webp",
  });

  const mats = useMemo(() => {
    const woodMap = cloneMap(maps.wood, 1.6, 1.2, true);
    const woodN = cloneMap(maps.woodN, 1.6, 1.2, false);
    const woodR = cloneMap(maps.woodR, 1.6, 1.2, false);
    const stoneMap = cloneMap(maps.stone, 1.4, 0.9, true);
    const stoneN = cloneMap(maps.stoneN, 1.4, 0.9, false);
    const tileMap = cloneMap(maps.tile, 3.2, 1.4, true);
    const tileN = cloneMap(maps.tileN, 3.2, 1.4, false);
    const wallN = cloneMap(maps.wallN, 8.2, 7.4, false);
    const potMap = cloneMap(maps.pot, 1, 1, true);
    const prof = roomProfile(kind);

    const wall = ghostMat(prof.wallColor, opacity, 0.9, { normalMap: wallN, envMapIntensity: 0.16, normalScale: new THREE.Vector2(0.11, 0.11) });
    const frame = ghostMat("#e4ddd2", Math.min(0.82, opacity + 0.12), 0.52);
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#e7f1ff",
      emissive: new THREE.Color("#f5f8ff"),
      emissiveIntensity: 0.72,
      roughness: 0.08,
      transparent: true,
      opacity: Math.min(0.38, opacity * 0.55),
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 0.55,
    });
    const fabric = ghostMat(kind === "bedroom" || kind === "living" || kind === "openplan" ? "#a88870" : kind === "dining" ? "#8d6a55" : "#cbb8a3", opacity, 0.86, { envMapIntensity: 0.22 });
    const chair = ghostMat("#7a5844", opacity, 0.82, { envMapIntensity: 0.22 });
    const wood = ghostMat("#d8c4a4", opacity, 0.42, { map: woodMap, normalMap: woodN, roughnessMap: woodR, envMapIntensity: 0.4 });
    const stone = ghostMat("#f2eee8", Math.min(0.8, opacity + 0.06), 0.28, { map: stoneMap, normalMap: stoneN, clearcoat: 0.35, clearcoatRoughness: 0.28, envMapIntensity: 0.55 });
    const metal = ghostMat("#b7b3ac", Math.min(0.72, opacity + 0.08), 0.28, { metalness: 0.72, envMapIntensity: 0.7 });
    const curtains = ghostMat("#e8d5be", Math.min(1, opacity * 0.95 + 0.02), 0.88, { side: THREE.DoubleSide, envMapIntensity: 0.2 });
    const leaf = ghostMat("#5d7a4c", opacity, 0.72, { envMapIntensity: 0.2 });
    const pot = ghostMat("#c56a3c", opacity, 0.62, { map: potMap, envMapIntensity: 0.3 });
    const dirt = ghostMat("#3d2c22", opacity, 1);
    const canvas = ghostMat("#efe8dc", opacity, 0.78);
    const accent = ghostMat("#8a5a44", opacity, 0.7);
    const shade = ghostMat("#f7f1e4", Math.min(0.7, opacity + 0.05), 0.9, { side: THREE.DoubleSide, emissive: new THREE.Color("#fff2d2"), emissiveIntensity: 0.18 });
    const tile = ghostMat("#ece7df", opacity, 0.45, { map: tileMap, normalMap: tileN, envMapIntensity: 0.32 });
    const bookA = ghostMat("#6d4c41", opacity, 0.78);
    const bookB = ghostMat("#4a5c6a", opacity, 0.78);
    const bookC = ghostMat("#b08968", opacity, 0.78);
    const cabinet = ghostMat("#d5c6b0", opacity, 0.62, { envMapIntensity: 0.3 });
    const linen = ghostMat("#f2ebe1", opacity, 0.9, { envMapIntensity: 0.18 });
    const porcelain = ghostMat("#f6f4f0", opacity, 0.32, { envMapIntensity: 0.4 });
    const rug = ghostMat(kind === "entry" ? "#6a4634" : "#7a4e38", opacity, 0.94, { envMapIntensity: 0.1 });
    const hearth = ghostMat("#2c211c", opacity, 0.55, { envMapIntensity: 0.2 });
    const screen = ghostMat("#16181c", Math.min(0.88, opacity + 0.08), 0.22, { envMapIntensity: 0.85, metalness: 0.35 });
    const paint = ghostMat("#f4f1ea", opacity, 0.9, { envMapIntensity: 0.14 });
    const accentWall = ghostMat(prof.accentColor || "#d4b49c", opacity, 0.88, { envMapIntensity: 0.16 });
    return { wall, frame, glass, fabric, chair, wood, stone, metal, curtains, leaf, pot, dirt, canvas, accent, shade, tile, bookA, bookB, bookC, cabinet, linen, porcelain, rug, hearth, screen, paint, accentWall };
  }, [maps, opacity, kind]);

  useLayoutEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  const wide = spanX >= 5.2;

  const showRoom = opacity > 0.012;
  return (
    <group visible={showRoom}>
      <Architecture key={kind} vis={vis} kind={kind} wall={mats.wall} frame={mats.frame} glass={mats.glass} curtains={mats.curtains} wood={mats.wood} evening={evening} />
      {profile.wainscot && (
        <>
          <Follow vis={vis} at={(_hx, hz) => [0, 0.58, -hz + 0.02]}>
            <Box size={[spanX - 0.06, 1.16, 0.028]} material={mats.tile} />
          </Follow>
          <Follow vis={vis} at={(hx) => ({ p: [-hx + 0.02, 0.58, 0], r: [0, Math.PI / 2, 0] })}>
            <Box size={[spanZ - 0.06, 1.16, 0.028]} material={mats.tile} />
          </Follow>
        </>
      )}
      {profile.beams && (
        <>
          {Array.from({ length: Math.max(4, Math.round(spanX / 0.48)) }, (_, i) => {
            const n = Math.max(4, Math.round(spanX / 0.48));
            const x = -spanX / 2 + 0.28 + (i * (spanX - 0.56)) / Math.max(1, n - 1);
            return (
              <Follow key={`joist-${i}`} vis={vis} at={() => [x, profile.wallH - 0.1, 0]}>
                <Box size={[0.065, 0.16, spanZ - 0.16]} material={mats.wood} />
              </Follow>
            );
          })}
          <Follow vis={vis} at={(_hx, hz) => [0, profile.wallH - 0.1, -hz + 0.07]}>
            <Box size={[spanX - 0.12, 0.16, 0.07]} material={mats.wood} />
          </Follow>
        </>
      )}
      {kind === "bedroom" && (() => {
        const accent = findBox("bedroom", spanX, spanZ, "bed-accent");
        if (!accent) return null;
        return (
        <Follow vis={vis} at={(hx, hz) => poseOf("bedroom", hx * 2, hz * 2, "bed-accent", "center")}>
          <Box size={[accent.hx * 2, accent.hy * 2, accent.hz * 2]} material={mats.accentWall} />
        </Follow>
        );
      })()}

      <Suspense fallback={null}>
        <FurnishedRoom kind={kind} vis={vis} spanX={spanX} spanZ={spanZ} showRug={showRug} opacity={opacity} />
      </Suspense>

      {kind === "living" && (
        <>
          {showRug && (
            <Follow vis={vis} at={(_hx, hz) => [0.1, 0, -hz + 2.18]}>
              <Rug fabric={mats.rug} w={2.72} d={1.98} />
            </Follow>
          )}
          <Follow vis={vis} at={(_hx, hz) => [0.02, 0, -hz + 1.14]}>
            <Sofa fabric={mats.fabric} wood={mats.wood} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => ({ p: [1.28, 0, -hz + 1.74], r: [0, -Math.PI / 2, 0] })}>
            <Chaise fabric={mats.fabric} wood={mats.wood} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [0.1, 0, -hz + 2.24]}>
            <CoffeeTable wood={mats.wood} stone={mats.stone} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [-1.24, 0, -hz + 1.16]}>
            <SideTable wood={mats.wood} stone={mats.stone} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [-1.4, 0, -hz + 1.16]}>
            <FloorLamp metal={mats.metal} shade={mats.shade} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("living", hx * 2, hz * 2, "living-fireplace")}>
            <Fireplace stone={mats.stone} wood={mats.wood} hearth={mats.hearth} screen={mats.screen} />
          </Follow>
          {wide && (
            <Follow vis={vis} at={(hx, hz) => ({ p: [Math.min(hx - 0.82, 1.78), 0, Math.min(0.52, hz - 1.15)], r: [0, -0.62, 0] })}>
              <Armchair fabric={mats.fabric} wood={mats.wood} />
            </Follow>
          )}
          <Follow vis={vis} at={(hx, hz) => [hx - 0.42, 0, hz - 0.48]}>
            <Plant pot={mats.pot} leaf={mats.leaf} dirt={mats.dirt} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("living", hx * 2, hz * 2, "living-art", "center")}>
            <group scale={(() => {
              const art = findBox("living", spanX, spanZ, "living-art");
              return art ? [(art.hx * 2) / 0.74, (art.hy * 2) / 0.55, 1] : [1, 1, 1];
            })()}>
              <Artwork frame={mats.wood} canvas={mats.canvas} accent={mats.accent} />
            </group>
          </Follow>
        </>
      )}

      {kind === "openplan" && (
        <>
          {showRug && (
            <Follow vis={vis} at={(hx, hz) => [-hx * 0.38, 0, Math.min(-0.15, hz * 0.08)]}>
              <Rug fabric={mats.rug} w={2.15} d={1.55} />
            </Follow>
          )}
          <Follow vis={vis} at={(hx, hz) => poseOf("openplan", hx * 2, hz * 2, "op-sofa")}>
            <Sofa fabric={mats.fabric} wood={mats.wood} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("openplan", hx * 2, hz * 2, "op-coffee")}>
            <CoffeeTable wood={mats.wood} stone={mats.stone} />
          </Follow>
        </>
      )}

      {kind === "entry" && showRug && (
        <Follow vis={vis} at={() => [0, 0, 0.08]}>
          <Rug fabric={mats.rug} w={1.15} d={0.68} />
        </Follow>
      )}


      {(kind === "living" || kind === "openplan" || kind === "dining" || kind === "bedroom" || kind === "entry" || kind === "office" || kind === "basement") && (
        <Follow vis={vis} at={(_hx, hz) => [kind === "living" ? 0.05 : 0, profile.wallH - (evening ? 0.48 : 0.55), kind === "living" ? -hz + 1.7 : kind === "openplan" ? 0.35 : 0]}>
          <Chandelier metal={mats.metal} glass={mats.shade} lit />
        </Follow>
      )}

      {kind === "stairs" && stairWell && (
        <>
          <StairRail wood={mats.wood} metal={mats.metal} paint={mats.paint} well={stairWell} />
          <Follow vis={vis} at={(hx, hz) => poseOf("stairs", hx * 2, hz * 2, "stairs-art", "center")}>
            <group scale={(() => {
              const art = findBox("stairs", spanX, spanZ, "stairs-art");
              return art ? [(art.hx * 2) / 0.74, (art.hy * 2) / 0.55, 1] : [1, 1, 1];
            })()}>
              <Artwork frame={mats.wood} canvas={mats.canvas} accent={mats.accent} />
            </group>
          </Follow>
        </>
      )}

      <ContactShadows
        key={`${kind}-${spanX.toFixed(2)}-${spanZ.toFixed(2)}`}
        position={[0, 0.016, 0]}
        opacity={0.62}
        scale={Math.max(spanX, spanZ) * 1.5}
        blur={1.85}
        far={3.6}
        frames={1}
        color="#211912"
      />
    </group>
  );
}
