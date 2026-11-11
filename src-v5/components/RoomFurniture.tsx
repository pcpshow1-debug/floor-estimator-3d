"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import type { RoomId } from "@/config/rooms";
import { poseOf } from "@/lib/room-layout";

type Vis = MutableRefObject<{ x: number; z: number }>;
type Pose = [number, number, number] | { p: [number, number, number]; r?: [number, number, number] };

function Follow({ vis, at, children }: { vis: Vis; at: (hx: number, hz: number) => Pose; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const out = at(vis.current.x / 2, vis.current.z / 2);
    if (Array.isArray(out)) g.position.set(out[0], out[1], out[2]);
    else {
      g.position.set(out.p[0], out.p[1], out.p[2]);
      if (out.r) g.rotation.set(out.r[0], out.r[1], out.r[2]);
    }
  });
  return <group ref={ref}>{children}</group>;
}

function kenneyFamily(name: string) {
  if (/loungeSofa|loungeChair|loungeDesign|ottoman|benchCushion|chairCushion|chairDesk/i.test(name)) return "fabric";
  if (/rug/i.test(name)) return "rug";
  if (/bathroomMirror/i.test(name)) return "mirror";
  if (/toilet|bathtub|bathroomSink|shower/i.test(name)) return "porcelain";
  if (/kitchenFridge|kitchenStove|hood|washer|dryer|television|computerScreen/i.test(name)) return "appliance";
  if (/lamp/i.test(name)) return "lamp";
  if (/plant|potted/i.test(name)) return "plant";
  if (/coatRack/i.test(name)) return "metal";
  return "wood";
}

const FAMILY_LOOK: Record<string, { color: string; roughness: number; metalness: number; env: number }> = {
  fabric: { color: "#9a7b64", roughness: 0.88, metalness: 0.02, env: 0.22 },
  rug: { color: "#6e4534", roughness: 0.96, metalness: 0, env: 0.1 },
  porcelain: { color: "#f3f0ea", roughness: 0.28, metalness: 0.05, env: 0.55 },
  mirror: { color: "#d5dde4", roughness: 0.08, metalness: 0.82, env: 1.1 },
  appliance: { color: "#c5c9cd", roughness: 0.34, metalness: 0.58, env: 0.72 },
  lamp: { color: "#b7a078", roughness: 0.38, metalness: 0.48, env: 0.55 },
  wood: { color: "#c2a47e", roughness: 0.5, metalness: 0.04, env: 0.4 },
  metal: { color: "#8d7a62", roughness: 0.42, metalness: 0.28, env: 0.5 },
  plant: { color: "#5c7548", roughness: 0.78, metalness: 0.02, env: 0.22 },
};

function applyLook(mat: THREE.MeshStandardMaterial, key: string, lightness?: number) {
  const look = FAMILY_LOOK[key];
  const dest = new THREE.Color(look.color);
  const dh = { h: 0, s: 0, l: 0 };
  dest.getHSL(dh);
  const l = lightness == null ? dh.l : THREE.MathUtils.clamp(lightness * 0.3 + dh.l * 0.7, 0.12, 0.9);
  dest.setHSL(dh.h, dh.s, l);
  mat.color.copy(dest);
  mat.roughness = look.roughness;
  mat.metalness = look.metalness;
  mat.envMapIntensity = look.env;
}

function neutralizeMaterial(mat: THREE.MeshStandardMaterial, name: string) {
  const family = kenneyFamily(name);
  const hsl = { h: 0, s: 0, l: 0 };
  mat.color.getHSL(hsl);
  const toyPink = hsl.s > 0.4 && (hsl.h < 0.08 || hsl.h > 0.88);

  if (family === "plant") {
    const neon = hsl.s > 0.55 || hsl.h < 0.18 || hsl.h > 0.5;
    if (neon) applyLook(mat, "plant");
    else mat.color.offsetHSL(0, -0.08, -0.04);
    return;
  }

  if (family === "porcelain") {
    if (mat.metalness > 0.35 || hsl.l < 0.22) {
      applyLook(mat, "appliance", hsl.l);
      return;
    }
    if (hsl.s > 0.12 && hsl.h > 0.04 && hsl.h < 0.16 && hsl.l < 0.68) {
      applyLook(mat, "wood", hsl.l);
      return;
    }
    if (mat.transparent || mat.opacity < 0.85 || (hsl.h > 0.48 && hsl.h < 0.72 && hsl.l > 0.55)) {
      mat.color.set("#c5d8e4");
      mat.roughness = 0.1;
      mat.metalness = 0.08;
      mat.transparent = true;
      mat.opacity = Math.min(mat.opacity ?? 1, 0.42);
      mat.envMapIntensity = 0.85;
      return;
    }
    applyLook(mat, "porcelain", hsl.l);
    return;
  }

  if (toyPink || (family === "fabric" && hsl.s > 0.35)) {
    applyLook(mat, "fabric", Math.min(hsl.l, 0.62));
    return;
  }
  applyLook(mat, family, hsl.l);
}

function Kenney({
  name,
  rotation = [0, 0, 0],
  scale = 1,
  opacity = 1,
}: {
  name: string;
  rotation?: [number, number, number];
  scale?: number;
  opacity?: number;
}) {
  const gltf = useGLTF(`/models/kenney/${name}.glb`);
  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const src = mesh.material;
      if (!src) return;
      const list = Array.isArray(src) ? src : [src];
      mesh.material = list.map((m) => {
        const copy = (m as THREE.MeshStandardMaterial).clone();
        copy.shadowSide = THREE.FrontSide;
        neutralizeMaterial(copy, name);
        return copy;
      });
      if (!Array.isArray(src)) mesh.material = (mesh.material as THREE.Material[])[0];
    });
    return root;
  }, [gltf, name]);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        const solid = opacity >= 0.985;
        mat.transparent = !solid;
        mat.opacity = opacity;
        mat.depthWrite = solid;
      });
    });
  }, [scene, opacity]);

  const fitted =
    scale !== 1
      ? scale
      : name === "table"
        ? 1.72
        : name === "chairCushion"
          ? 1.52
          : name.startsWith("kitchen") || name === "hoodModern"
            ? 1.2
            : name === "bedDouble"
              ? 1.3
              : name === "desk" || name === "chairDesk"
                ? 1.22
                : name === "loungeSofa" || name === "tableCoffee"
                  ? 1.22
                  : name === "bathroomSink"
                    ? 1.7
                  : name === "bathtub" || name === "shower" || name === "toilet"
                    ? 1.12
                    : 1;
  return <primitive object={scene} rotation={rotation} scale={fitted} />;
}


function fadedMat(opacity: number) {
  return opacity < 0.985;
}

function VanityCabinet({ opacity }: { opacity: number }) {
  const fade = fadedMat(opacity);
  return (
    <group>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.76, 0.68, 0.4]} />
        <meshStandardMaterial color="#c4a07a" roughness={0.62} metalness={0.06} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.05, 0.01]} receiveShadow>
        <boxGeometry args={[0.74, 0.1, 0.36]} />
        <meshStandardMaterial color="#b08b64" roughness={0.7} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.735, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.045, 0.44]} />
        <meshStandardMaterial color="#e8e2da" roughness={0.32} metalness={0.08} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.755, 0.05]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.135, 0.05, 24]} />
        <meshStandardMaterial color="#f3f0eb" roughness={0.2} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.86, -0.13]} castShadow>
        <cylinderGeometry args={[0.013, 0.015, 0.22, 10]} />
        <meshStandardMaterial color="#8a8680" roughness={0.28} metalness={0.55} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.955, -0.055]} rotation={[1.15, 0, 0]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.16, 10]} />
        <meshStandardMaterial color="#8a8680" roughness={0.28} metalness={0.55} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[-0.185, 0.38, 0.204]} castShadow>
        <boxGeometry args={[0.33, 0.5, 0.014]} />
        <meshStandardMaterial color="#b8936e" roughness={0.58} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[0.185, 0.38, 0.204]} castShadow>
        <boxGeometry args={[0.33, 0.5, 0.014]} />
        <meshStandardMaterial color="#b8936e" roughness={0.58} transparent={fade} opacity={opacity} />
      </mesh>
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, 0.38, 0.216]}>
          <boxGeometry args={[0.012, 0.078, 0.016]} />
          <meshStandardMaterial color="#8a8680" roughness={0.3} metalness={0.5} transparent={fade} opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

function WallMirror({ opacity }: { opacity: number }) {
  const fade = fadedMat(opacity);
  return (
    <group>
      <mesh position={[0, 0, -0.012]} castShadow>
        <boxGeometry args={[0.58, 0.68, 0.034]} />
        <meshStandardMaterial color="#c4a07a" roughness={0.55} transparent={fade} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[0.48, 0.58]} />
        <meshPhysicalMaterial color="#d5e3ee" roughness={0.06} metalness={0.28} transparent={fade} opacity={opacity} />
      </mesh>
    </group>
  );
}

function Towel({ color, opacity }: { color: string; opacity: number }) {
  return (
    <mesh position={[0, 0.42, 0]} castShadow>
      <boxGeometry args={[0.28, 0.72, 0.05]} />
      <meshStandardMaterial color={color} roughness={0.92} transparent={opacity < 0.985} opacity={opacity} />
    </mesh>
  );
}

function Shoes({ opacity }: { opacity: number }) {
  return (
    <group>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.04, 0]} castShadow>
          <boxGeometry args={[0.1, 0.07, 0.26]} />
          <meshStandardMaterial color="#2c241c" roughness={0.78} transparent={opacity < 0.985} opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

export function FurnishedRoom({
  kind,
  vis,
  spanX,
  showRug,
  opacity,
}: {
  kind: RoomId;
  vis: Vis;
  spanX: number;
  spanZ: number;
  showRug: boolean;
  opacity: number;
}) {
  const o = opacity;
  return (
    <group>
      {kind === "living" && null}

      {kind === "kitchen" && (
        <>
          <Follow vis={vis} at={(hx, hz) => poseOf("kitchen", hx * 2, hz * 2, "kit-cab")}>
            <Kenney name="kitchenCabinet" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("kitchen", hx * 2, hz * 2, "kit-sink")}>
            <Kenney name="kitchenSink" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("kitchen", hx * 2, hz * 2, "kit-stove")}>
            <Kenney name="kitchenStove" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("kitchen", hx * 2, hz * 2, "kit-stove")}>
            <Kenney name="hoodModern" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("kitchen", hx * 2, hz * 2, "kit-cab")}>
            <Kenney name="kitchenCabinetUpper" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("kitchen", hx * 2, hz * 2, "kit-fridge")}>
            <Kenney name="kitchenFridgeLarge" opacity={o} />
          </Follow>
          <Follow vis={vis} at={() => [0.05, 0, 0.15]}>
            <Kenney name="kitchenCabinetDrawer" opacity={o} />
          </Follow>
          <Follow vis={vis} at={() => [-0.35, 0, 0.72]}>
            <Kenney name="stoolBar" opacity={o} />
          </Follow>
          <Follow vis={vis} at={() => [0.4, 0, 0.72]}>
            <Kenney name="stoolBar" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.4, 0, hz - 0.45]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "dining" && (
        <>
          <Follow vis={vis} at={() => [0, 0, 0.05]}>
            <Kenney name="table" opacity={o} />
          </Follow>
          {[-0.95, 0.95].flatMap((z) =>
            [-0.82, 0.82].map((x) => (
              <Follow key={`${x}-${z}`} vis={vis} at={() => ({ p: [x, 0, z], r: [0, z > 0 ? Math.PI : 0, 0] })}>
                <Kenney name="chairCushion" opacity={o} />
              </Follow>
            )),
          )}
          <Follow vis={vis} at={(_hx, hz) => [0, 0, -hz + 0.32]}>
            <Kenney name="sideTableDrawers" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.4, 0, hz - 0.45]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "bedroom" && (
        <>
          <Follow vis={vis} at={(_hx, hz) => [0, 0, -hz + 1.15]}>
            <Kenney name="bedDouble" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [-1.15, 0, -hz + 0.55]}>
            <Kenney name="cabinetBedDrawer" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [1.15, 0, -hz + 0.55]}>
            <Kenney name="cabinetBedDrawer" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [-1.15, 0, -hz + 0.55]}>
            <Kenney name="lampRoundTable" opacity={o} />
          </Follow>
          {spanX >= 3.6 && (
            <Follow vis={vis} at={(hx, _hz) => ({ p: [hx - 0.35, 0, 0.2], r: [0, -Math.PI / 2, 0] })}>
              <Kenney name="bookcaseOpen" opacity={o} />
            </Follow>
          )}
          <Follow vis={vis} at={(hx, hz) => [-hx + 0.35, 0, hz - 0.42]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "bathroom" && (
        <>
          <Follow vis={vis} at={(hx, hz) => poseOf("bathroom", hx * 2, hz * 2, "bath-vanity")}>
            <VanityCabinet opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("bathroom", hx * 2, hz * 2, "bath-mirror", "center")}>
            <WallMirror opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("bathroom", hx * 2, hz * 2, "bath-toilet")}>
            <Kenney name="toilet" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("bathroom", hx * 2, hz * 2, "bath-shower")}>
            <Kenney name="shower" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("bathroom", hx * 2, hz * 2, "bath-towel-a")}>
            <Towel color="#d9c4ae" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("bathroom", hx * 2, hz * 2, "bath-towel-b")}>
            <Towel color="#eee4d6" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "entry" && (
        <>
          <Follow vis={vis} at={(_hx, hz) => [0, 0, -hz + 0.3]}>
            <Kenney name="sideTableDrawers" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [-hx + 0.42, 0, 0.15]}>
            <Kenney name="benchCushion" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("entry", hx * 2, hz * 2, "entry-coatrack")}>
            <Kenney name="coatRack" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.32, 0, -0.2]}>
            <Kenney name="coatRackStanding" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [-hx + 0.55, 0, 0.55]}>
            <Shoes opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.38, 0, hz - 0.4]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "office" && (
        <>
          <Follow vis={vis} at={(_hx, hz) => [0.1, 0, -hz + 0.55]}>
            <Kenney name="desk" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [0.1, 0, -hz + 0.55]}>
            <Kenney name="computerScreen" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [0.35, 0, -hz + 0.55]}>
            <Kenney name="laptop" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [0.1, 0, -hz + 1.15]}>
            <Kenney name="chairDesk" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("office", hx * 2, hz * 2, "off-case")}>
            <Kenney name="bookcaseOpen" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.35, 0, -hz + 0.35]}>
            <Kenney name="lampRoundFloor" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.4, 0, hz - 0.42]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "basement" && (
        <>
          <Follow vis={vis} at={(_hx, hz) => [0.1, 0, -hz + 1.05]}>
            <Kenney name="loungeSofa" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [0.1, 0, -hz + 1.95]}>
            <Kenney name="tableCoffee" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.42, 0, 0.15]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "openplan" && (
        <>
          <Follow vis={vis} at={(_hx, hz) => ({ p: [-1.35, 0, -hz + 0.38], r: [0, 0, 0] })}>
            <Kenney name="kitchenCabinet" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => ({ p: [-0.55, 0, -hz + 0.38], r: [0, 0, 0] })}>
            <Kenney name="kitchenSink" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => ({ p: [0.25, 0, -hz + 0.38], r: [0, 0, 0] })}>
            <Kenney name="kitchenStove" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [1.15, 0, -hz + 0.42]}>
            <Kenney name="kitchenFridgeLarge" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => poseOf("openplan", hx * 2, hz * 2, "op-island")}>
            <Kenney name="kitchenCabinetDrawer" opacity={o} />
          </Follow>
          <Follow vis={vis} at={() => [-0.85, 0, 0.5]}>
            <Kenney name="stoolBar" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [-hx * 0.55, 0, Math.min(hz * 0.35, -0.15)]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "laundry" && (
        <>
          <Follow vis={vis} at={(_hx, hz) => [-0.4, 0, -hz + 0.4]}>
            <Kenney name="washer" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(_hx, hz) => [0.4, 0, -hz + 0.4]}>
            <Kenney name="dryer" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [-hx + 0.48, 0, 0.15]}>
            <Kenney name="benchCushion" opacity={o} />
          </Follow>
          <Follow vis={vis} at={(hx, hz) => [hx - 0.32, 0, hz - 0.36]}>
            <Kenney name="pottedPlant" opacity={o} />
          </Follow>
        </>
      )}

      {kind === "stairs" && (
        <Follow vis={vis} at={(hx, hz) => [hx - 0.34, 0, hz - 0.4]}>
          <Kenney name="pottedPlant" opacity={o} />
        </Follow>
      )}
    </group>
  );
}

useGLTF.preload("/models/kenney/loungeSofa.glb");
useGLTF.preload("/models/kenney/pottedPlant.glb");
