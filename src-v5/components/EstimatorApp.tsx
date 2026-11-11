"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { lead } from "@/config/lead";
import { EstimateResultView } from "@/components/EstimateResult";
import { computeEstimate } from "@/lib/pricing/engine";
import { loadRateCard } from "@/lib/pricing/store";
import { lookupWaDorTax } from "@/lib/pricing/tax";
import type { PricingInput, TaxResult } from "@/lib/pricing/types";
import {
  grouts,
  patterns,
  sealers,
  sheens,
  species,
  speciesMaps,
  stains,
  tileMaps,
  tileStyles,
  groutWidths,
  type CameraView,
  type FamilyId,
  type GroutId,
  type GroutWidthId,
  type JobId,
  type PatternId,
  type SealerId,
  type SheenId,
  type SpeciesId,
  type StainId,
  type TileStyleId,
  type WoodMode,
} from "@/config/products";
import type { SampleState } from "./FloorStage";
import { rooms, roomById, type RoomId } from "@/config/rooms";

const FloorStage = dynamic(() => import("./FloorStage").then((m) => m.FloorStage), { ssr: false });

type Anim = "lay" | "refinish" | null;

type ExtraRoom = {
  id: string;
  name: string;
  lengthFt: number | null;
  widthFt: number | null;
  floorSqft: number | null;
  wallOrShowerSqft: number | null;
  areaSource: "lxw" | "manual";
};

type InspectionFlags = PricingInput["flags"];

type State = SampleState & {
  step: number;
  refinishPackage: PricingInput["refinishPackage"];
  installMaterial: PricingInput["installMaterial"];
  calcMode: PricingInput["calcMode"];
  siteFinishSeparate: boolean;
  extraRooms: ExtraRoom[];
  wallOrShowerSqft: number | null;
  zip: string;
  streetAddress: string;
  city: string;
  removalKind: PricingInput["removal"]["kind"];
  removalAreaSqft: number | null;
  subfloorSelected: boolean;
  subfloorAreaSqft: number | null;
  stairsSelected: boolean;
  stairsCount: number | null;
  furnitureMoving: PricingInput["furnitureMoving"];
  productPricePerSqft: number | null;
  cartonCoverageSqft: number | null;
  inspectionFlags: InspectionFlags;
};

export type { State };

const initial: State = {
  step: 0,
  job: "new",
  family: "hardwood",
  species: "white-oak",
  pattern: "straight",
  woodMode: "stain",
  sealerId: "natural-seal",
  stainId: "golden-oak",
  sheen: "satin",
  tileStyle: "porcelain-24",
  grout: "grey",
  groutWidth: "standard",
  lengthFt: 18,
  widthFt: 14,
  view: "floor",
  refinishPackage: "full_sand_natural",
  installMaterial: "unknown",
  calcMode: "installed_package",
  siteFinishSeparate: false,
  extraRooms: [],
  wallOrShowerSqft: null,
  zip: "",
  streetAddress: "",
  city: "",
  removalKind: "none",
  removalAreaSqft: null,
  subfloorSelected: false,
  subfloorAreaSqft: null,
  stairsSelected: false,
  stairsCount: null,
  furnitureMoving: "no",
  productPricePerSqft: null,
  cartonCoverageSqft: null,
  inspectionFlags: {},
};

type Store = {
  state: State;
  anim: Anim;
  nonce: number;
  finishAnim: () => void;
  skipAnim: () => void;
  back: () => void;
  setJob: (job: JobId) => void;
  setFamily: (family: FamilyId) => void;
  setSpecies: (id: SpeciesId) => void;
  setPattern: (id: PatternId) => void;
  setWoodMode: (mode: WoodMode) => void;
  setSealer: (id: SealerId) => void;
  setStain: (id: StainId) => void;
  setSheen: (id: SheenId) => void;
  setTileStyle: (id: TileStyleId) => void;
  setGrout: (id: GroutId) => void;
  setGroutWidth: (id: GroutWidthId) => void;
  setLength: (n: number) => void;
  setWidth: (n: number) => void;
  setView: (view: CameraView) => void;
  setStep: (n: number) => void;
  next: () => void;
  patch: (partial: Partial<State>) => void;
  roomMode: null | "pick" | RoomId;
  ghost: number;
  setRoomMode: (mode: null | "pick" | RoomId) => void;
  setGhost: (n: number) => void;
  evening: boolean;
  setEvening: (v: boolean) => void;
  showRug: boolean;
  setShowRug: (v: boolean) => void;
  enterRoom: (id: RoomId) => void;
};

const Ctx = createContext<Store | null>(null);

function areaOf(length: number, width: number) {
  const a = length * width;
  return !Number.isFinite(a) || a <= 0 ? 0 : Math.round(10 * a) / 10;
}

function sqftOf(state: State) {
  return areaOf(state.lengthFt, state.widthFt);
}

function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initial);
  const [anim, setAnim] = useState<Anim>(null);
  const [nonce, setNonce] = useState(0);
  const [roomMode, setRoomMode] = useState<null | "pick" | RoomId>(null);
  const [ghost, setGhost] = useState(0.5);
  const [evening, setEvening] = useState(false);
  const [showRug, setShowRug] = useState(true);
  const floorPref = useRef<{ family: State["family"]; installMaterial: State["installMaterial"] } | null>(null);

  const play = useCallback((next: Anim, patch: Partial<State>) => {
    setState((s) => ({ ...s, ...patch }));
    if (next) {
      setAnim(next);
      setNonce((n) => n + 1);
    }
  }, []);

  const store: Store = {
    state,
    anim,
    nonce,
    finishAnim: () => setAnim(null),
    skipAnim: () => setAnim(null),
    back: () => {
      if (roomMode && roomMode !== "pick") {
        setRoomMode("pick");
        return;
      }
      if (roomMode === "pick") {
        setRoomMode(null);
        return;
      }
      setState((s) => {
        if (s.step <= 0) return s;
        if (s.step === 2 && s.job === "refinish") return { ...s, step: 0 };
        return { ...s, step: s.step - 1 };
      });
    },
    setJob: (job) => {
      setRoomMode(null);
      if (job === "refinish") play("refinish", { job, family: "hardwood", species: "white-oak", pattern: "straight", step: 2, installMaterial: "unknown", refinishPackage: "full_sand_natural" });
      else play("lay", { job, step: 1 });
    },
    setFamily: (family) => play("lay", { family, step: 2, installMaterial: family === "tile" ? "tile" : "unknown" }),
    setSpecies: (species) => setState((s) => ({ ...s, species })),
    setPattern: (pattern) => play("lay", { pattern }),
    setWoodMode: (woodMode) =>
      setState((s) => ({
        ...s,
        woodMode,
        refinishPackage:
          s.job === "refinish" && s.refinishPackage !== "screen_recoat"
            ? woodMode === "stain"
              ? "full_sand_stained"
              : "full_sand_natural"
            : s.refinishPackage,
      })),
    setSealer: (sealerId) => setState((s) => ({ ...s, sealerId })),
    setStain: (stainId) => setState((s) => ({ ...s, stainId })),
    setSheen: (sheen) => setState((s) => ({ ...s, sheen })),
    setTileStyle: (tileStyle) => play("lay", { tileStyle }),
    setGrout: (grout) => setState((s) => ({ ...s, grout })),
    setGroutWidth: (groutWidth) => setState((s) => ({ ...s, groutWidth })),
    setLength: (lengthFt) => setState((s) => ({ ...s, lengthFt })),
    setWidth: (widthFt) => setState((s) => ({ ...s, widthFt })),
    setView: (view) => setState((s) => ({ ...s, view })),
    setStep: (step) =>
      setState((s) => {
        let next = step;
        if (s.job === "refinish" && next === 1) next = 0;
        return { ...s, step: next };
      }),
    next: () => setState((s) => ({ ...s, step: Math.min(3, s.step + 1) })),
    patch: (partial) => setState((s) => ({ ...s, ...partial })),
    roomMode,
    ghost,
    setRoomMode,
    setGhost,
    evening,
    setEvening,
    showRug,
    setShowRug,
    enterRoom: (id) => {
      const room = roomById(id);
      if (!room) return;
      setRoomMode(id);
      setState((cur) => {
        if (cur.job !== "new") return cur;
        if (room.defaultFamily === "tile") {
          if (!floorPref.current) floorPref.current = { family: cur.family, installMaterial: cur.installMaterial };
          return { ...cur, family: "tile", installMaterial: "tile" };
        }
        if (floorPref.current) {
          const prev = floorPref.current;
          floorPref.current = null;
          return { ...cur, family: prev.family, installMaterial: prev.installMaterial };
        }
        return cur;
      });
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Estimator store missing");
  return ctx;
}

function Card({ label, image, on, onClick }: { label: string; image: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={on ? "card on" : "card"} onClick={onClick} aria-pressed={on}>
      <img src={image} alt="" />
      <span>{label}</span>
    </button>
  );
}

function PatternMark({ id }: { id: string }) {
  if (id === "herringbone") {
    return (
      <svg className="mark" viewBox="0 0 100 80" aria-hidden>
        <path d="M10 70 L30 20 L40 20 L20 70 Z M40 70 L60 20 L70 20 L50 70 Z M70 70 L90 20" fill="none" stroke="#fff" strokeWidth="3" />
      </svg>
    );
  }
  if (id === "chevron") {
    return (
      <svg className="mark" viewBox="0 0 100 80" aria-hidden>
        <path d="M8 20 L50 55 L92 20 M8 40 L50 75 L92 40" fill="none" stroke="#fff" strokeWidth="4" />
      </svg>
    );
  }
  return (
    <svg className="mark" viewBox="0 0 100 80" aria-hidden>
      <path d="M8 16 H92 M8 32 H92 M8 48 H92 M8 64 H92" fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

function TileMark({ id }: { id: string }) {
  if (id === "hex") {
    return (
      <svg className="mark" viewBox="0 0 100 80" aria-hidden>
        <path d="M30 18 L42 25 L42 39 L30 46 L18 39 L18 25 Z M58 18 L70 25 L70 39 L58 46 L46 39 L46 25 Z M44 40 L56 47 L56 61 L44 68 L32 61 L32 47 Z" fill="none" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  }
  if (id === "square") {
    return (
      <svg className="mark" viewBox="0 0 100 80" aria-hidden>
        <path d="M22 14 H40 V32 H22 Z M48 14 H66 V32 H48 Z M74 14 H92 V32 H74 Z M22 40 H40 V58 H22 Z M48 40 H66 V58 H48 Z" fill="none" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  }
  if (id === "marble-herringbone") {
    return (
      <svg className="mark" viewBox="0 0 100 80" aria-hidden>
        <path d="M16 62 L34 28 H42 L24 62 Z M42 62 L60 28 H68 L50 62 Z" fill="none" stroke="#fff" strokeWidth="2.5" />
      </svg>
    );
  }
  return (
    <svg className="mark" viewBox="0 0 100 80" aria-hidden>
      <path d="M12 18 H58 V62 H12 Z M64 18 H90 V40 H64 Z M64 46 H90 V62 H64 Z" fill="none" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}

function WorkStep() {
  const { setJob } = useStore();
  return (
    <div className="chooser-wrap">
      <div className="cards job">
        <button type="button" className="card" onClick={() => setJob("refinish")}>
          <img src="/photos/jobs/job-refinish.webp" alt="" />
          <span>Refinish existing floor</span>
        </button>
        <button type="button" className="card" onClick={() => setJob("new")}>
          <img src="/photos/jobs/job-new-floor.webp" alt="" />
          <span>New floor</span>
        </button>
      </div>
    </div>
  );
}

function RoomPicker() {
  const { enterRoom } = useStore();
  return (
    <>
      <h2>Choose a room</h2>
      <p className="note">See your floor in furnished rooms flooring contractors work in most often. Drag the visibility slider from invisible to a finished interior.</p>
      <div className="cards two room-cards">
        {rooms.map((room) => (
          <button key={room.id} type="button" className="card" onClick={() => enterRoom(room.id)}>
            <span className={`room-thumb ${room.id}`} aria-hidden>
              <img src={room.thumb} alt="" />
            </span>
            <span>{room.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function RoomControls({ roomId }: { roomId: RoomId }) {
  const { ghost, setGhost, evening, setEvening, showRug, setShowRug, state } = useStore();
  const room = roomById(roomId);
  if (!room) return null;
  const priced = sqftOf(state);
  return (
    <>
      <h2>{room.label}</h2>
      <p className="note">Set how solid the room looks. 0% hides walls and furniture; 100% is a finished interior. The floor stays live either way.</p>
      <p className="note">This preview uses a typical {room.label.toLowerCase()} layout. Your estimate still uses the {state.lengthFt} × {state.widthFt} ft you entered ({priced} sq ft).</p>
      <label className="ghost-slider">
        <span className="row"><span>Room visibility</span> <b>{Math.round(ghost * 100)}%</b></span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={ghost}
          aria-label="Room visibility from 0 to 100 percent"
          onChange={(e) => setGhost(Number(e.target.value))}
        />
      </label>
      <div className="room-toggles">
        <label className="toggle">
          <input type="checkbox" checked={evening} onChange={(e) => setEvening(e.target.checked)} />
          Evening light
        </label>
        <label className="toggle">
          <input type="checkbox" checked={!showRug} onChange={(e) => setShowRug(!e.target.checked)} />
          Hide rug
        </label>
      </div>
    </>
  );
}

function FloorStep() {

  const { state, setFamily } = useStore();
  return (
    <>
      <h2>Hardwood or tile?</h2>
      <div className="cards two">
        <Card label="Hardwood" image="/textures/white-oak/card.webp" on={state.family === "hardwood"} onClick={() => setFamily("hardwood")} />
        <Card label="Tile" image="/textures/carrara/card.webp" on={state.family === "tile"} onClick={() => setFamily("tile")} />
      </div>
    </>
  );
}


function SizeSliders() {
  const { state, setLength, setWidth } = useStore();
  const area = sqftOf(state);
  return (
    <div className="size-sliders">
      <p className="section-label">Room size</p>
      <label>
        <span className="row">
          <span>Length</span>
          <span className="row-input">
            <input
              type="number"
              min={6}
              max={80}
              step={0.5}
              value={state.lengthFt}
              aria-label="Room length in feet, typed"
              className="dim-input"
              onChange={(e) => setLength(Number(e.target.value))}
            />
            <b>ft</b>
          </span>
        </span>
        <input
          type="range"
          min={8}
          max={36}
          step={0.5}
          value={Math.min(36, Math.max(8, state.lengthFt))}
          aria-label="Room length in feet"
          onChange={(e) => setLength(Number(e.target.value))}
        />
      </label>
      <label>
        <span className="row">
          <span>Width</span>
          <span className="row-input">
            <input
              type="number"
              min={6}
              max={80}
              step={0.5}
              value={state.widthFt}
              aria-label="Room width in feet, typed"
              className="dim-input"
              onChange={(e) => setWidth(Number(e.target.value))}
            />
            <b>ft</b>
          </span>
        </span>
        <input
          type="range"
          min={8}
          max={36}
          step={0.5}
          value={Math.min(36, Math.max(8, state.widthFt))}
          aria-label="Room width in feet"
          onChange={(e) => setWidth(Number(e.target.value))}
        />
      </label>
      <p className="size-area">{state.lengthFt.toFixed(1)} × {state.widthFt.toFixed(1)} ft · {area} sq ft</p>
    </div>
  );
}

function TileStep() {
  const store = useStore();
  const { state, setTileStyle, setGrout } = store;
  return (
    <>
      <h2>Tile</h2>
      <div className="cards">
        {tileStyles.map((item) => (
          <button key={item.id} type="button" className={state.tileStyle === item.id ? "card on" : "card"} onClick={() => setTileStyle(item.id)} aria-pressed={state.tileStyle === item.id}>
            <span className="ph">
              <img src={tileMaps(item.id).card} alt="" />
              {item.pattern === "hex" && <TileMark id="hex" />}
              {item.pattern === "herringbone" && <TileMark id="marble-herringbone" />}
              {item.id === "square-mosaic" && <TileMark id="square" />}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <p className="note">{tileStyles.find((t) => t.id === state.tileStyle)?.detail}</p>
      <SizeSliders />
      <div className="grouts">
        <span>Grout color</span>
        {grouts.map((item) => (
          <button key={item.id} type="button" className={state.grout === item.id ? "grout on" : "grout"} onClick={() => setGrout(item.id)}>
            <b style={{ background: item.color }} />
            {item.label}
          </button>
        ))}
      </div>
      <p className="section-label">Grout width</p>
      <div className="pills">
        {groutWidths.map((item) => (
          <button key={item.id} type="button" className={state.groutWidth === item.id ? "pill on" : "pill"} onClick={() => store.setGroutWidth(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

function FinishStep() {
  const store = useStore();
  const { state } = store;
  if (state.job === "new" && state.family === "tile") return <TileStep />;
  const tones = state.woodMode === "sealer" ? sealers : stains;
  const currentId = state.woodMode === "sealer" ? state.sealerId : state.stainId;
  const index = Math.max(0, tones.findIndex((t) => t.id === currentId));
  const active = tones[index];
  return (
    <>
      <h2>{state.job === "refinish" ? "Finish the wood" : "Hardwood"}</h2>
      {state.job === "new" && (
        <>
          <p className="section-label">Species</p>
          <div className="cards">
            {species.map((item) => (
              <Card
                key={item.id}
                label={item.label}
                image={speciesMaps(item.id).card}
                on={state.species === item.id}
                onClick={() => store.setSpecies(item.id)}
              />
            ))}
          </div>
          <p className="section-label">Pattern</p>
          <div className="cards">
            {patterns.map((item) => (
              <button key={item.id} type="button" className={state.pattern === item.id ? "card on" : "card"} onClick={() => store.setPattern(item.id)} aria-pressed={state.pattern === item.id}>
                <span className="ph">
                  <img src="/textures/white-oak/card.webp" alt="" />
                  <PatternMark id={item.id} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {state.job === "refinish" && <p className="note">We sand what is there, then coat it. Species follows the existing oak.</p>}
      {state.job === "refinish" && (
        <>
          <p className="section-label">Refinish package</p>
          <div className="pills">
            {([
              ["screen_recoat", "Screen and recoat"],
              ["full_sand_natural", "Full sand, natural"],
              ["full_sand_stained", "Full sand, stained"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={state.refinishPackage === id ? "pill on" : "pill"} onClick={() => store.patch({ refinishPackage: id, woodMode: id === "full_sand_stained" ? "stain" : "sealer" })}>
                {label}
              </button>
            ))}
          </div>
          <p className="note">These packages are alternatives. Sanding and finish that are already in the package are not added again.</p>
        </>
      )}
      {state.job === "new" && state.family === "hardwood" && (
        <>
          <p className="section-label">Flooring type</p>
          <div className="pills">
            {([
              ["engineered", "Engineered"],
              ["solid", "Solid"],
              ["parquet", "Parquet"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={state.installMaterial === id ? "pill on" : "pill"} onClick={() => store.patch({ installMaterial: id })}>
                {label}
              </button>
            ))}
          </div>
          <p className="note">Required for pricing. The estimator will not guess engineered versus solid versus parquet.</p>
        </>
      )}
      <p className="section-label">Coating</p>
      <div className="pills">
        <button type="button" className={state.woodMode === "sealer" ? "pill on" : "pill"} onClick={() => store.setWoodMode("sealer")}>
          Bona sealer
        </button>
        <button type="button" className={state.woodMode === "stain" ? "pill on" : "pill"} onClick={() => store.setWoodMode("stain")}>
          DuraSeal stain
        </button>
      </div>
      {active && (
        <div className="slider-block">
          <header>
            <span>{active.label}</span>
            <small>{"code" in active ? active.code : active.detail}</small>
          </header>
          <div className="swatches" role="listbox" aria-label={state.woodMode === "sealer" ? "Sealer color" : "Stain color"}>
            {tones.map((tone) => {
              const on = tone.id === currentId;
              return (
                <button
                  key={tone.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  aria-label={tone.label}
                  className={on ? "swatch on" : "swatch"}
                  style={{ background: tone.color }}
                  onClick={() => {
                    if (state.woodMode === "sealer") store.setSealer(tone.id as SealerId);
                    else store.setStain(tone.id as StainId);
                  }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, tones.length - 1)}
            step={1}
            value={index}
            aria-label={state.woodMode === "sealer" ? "Sealer, light to warm" : "Stain, light to dark"}
            onChange={(e) => {
              const next = tones[Number(e.target.value)];
              if (!next) return;
              if (state.woodMode === "sealer") store.setSealer(next.id as SealerId);
              else store.setStain(next.id as StainId);
            }}
          />
          <div className="slider-ends">
            <span>Light</span>
            <span>{state.woodMode === "sealer" ? "Warm" : "Dark"}</span>
          </div>
        </div>
      )}
      <p className="section-label">Sheen</p>
      <div className="pills">
        {sheens.map((item) => (
          <button key={item.id} type="button" className={state.sheen === item.id ? "pill on" : "pill"} onClick={() => store.setSheen(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <SizeSliders />
    </>
  );
}

function LeadForm({ snapshot }: { snapshot: string | null }) {
  const { state, patch, roomMode } = useStore();
  const [form, setForm] = useState({ name: "", phone: "", email: "", zip: state.zip, preferredDate: "", consent: false });
  const [hp, setHp] = useState("");
  const [status, setStatus] = useState<"idle" | "demo" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (status === "demo") {
    return (
      <div className="success" role="status">
        <p className="success-kicker">{brand.logoText}</p>
        <h3>{lead.demoSuccessTitle}</h3>
        <p>{lead.demoSuccessBody}</p>
        <p>
          <a href={`tel:${brand.phoneTel}`}>{brand.phoneDisplay}</a>
        </p>
      </div>
    );
  }

  return (
    <form
      className="lead"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (form.name.trim().length < 2) next["contact.name"] = "Enter your name.";
        const digits = form.phone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) next["contact.phone"] = "Enter a phone number with area code.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next["contact.email"] = "Enter a valid email.";
        if (!/^\d{5}(-\d{4})?$/.test(form.zip.trim())) next["contact.zip"] = "Use a 5-digit ZIP.";
        if (!form.consent) next["contact.consent"] = "Consent is required.";
        setErrors(next);
        if (Object.keys(next).length) return;
        if (hp.trim() || !lead.enabled) {
          setStatus("demo");
          return;
        }
        setStatus("demo");
      }}
    >
      <p className="lead-note">Delivery is off. Submitting checks the form and stops. Nothing is saved and Vlad is not contacted.</p>
      <div className="hp" aria-hidden>
        <label>
          Company website
          <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <label>Name</label>
        <input className="field-input" value={form.name} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        {errors["contact.name"] && <p className="err">{errors["contact.name"]}</p>}
      </div>
      <div className="field">
        <label>Phone</label>
        <input className="field-input" value={form.phone} autoComplete="tel" inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        {errors["contact.phone"] && <p className="err">{errors["contact.phone"]}</p>}
      </div>
      <div className="field">
        <label>Email</label>
        <input className="field-input" value={form.email} autoComplete="email" inputMode="email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {errors["contact.email"] && <p className="err">{errors["contact.email"]}</p>}
      </div>
      <div className="split">
        <div className="field">
          <label>ZIP</label>
          <input className="field-input" value={form.zip} autoComplete="postal-code" inputMode="numeric" onChange={(e) => { setForm({ ...form, zip: e.target.value }); patch({ zip: e.target.value }); }} />
          {errors["contact.zip"] && <p className="err">{errors["contact.zip"]}</p>}
        </div>
        <div className="field">
          <label>Preferred date</label>
          <input className="field-input" type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
        </div>
      </div>
      <label className="consent">
        <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
        <span>I agree to be contacted about this floor. Sending is off in this preview, and this is not a quote.</span>
      </label>
      {errors["contact.consent"] && <p className="err">{errors["contact.consent"]}</p>}
      <button type="submit" className="continue">
        Request a visit
      </button>
      <span hidden>{snapshot ? "snapshot ready" : ""}</span>
      <span hidden>{state.species}</span>
    </form>
  );
}

function extraRoomArea(room: ExtraRoom) {
  if (room.areaSource === "manual") return room.floorSqft;
  if (room.lengthFt != null && room.widthFt != null) return areaOf(room.lengthFt, room.widthFt);
  return room.floorSqft;
}

function toPricingInput(state: State, roomMode?: string | null): PricingInput {
  const layoutPattern: PricingInput["layoutPattern"] =
    state.pattern === "herringbone" || state.pattern === "chevron" || String(state.tileStyle).includes("herringbone")
      ? "herringbone"
      : "straight";
  const primary: PricingInput["rooms"][number] = {
    id: "primary",
    name: "Room 1",
    floorSqft: sqftOf(state),
    wallOrShowerSqft: state.wallOrShowerSqft,
    lengthFt: state.lengthFt,
    widthFt: state.widthFt,
    areaSource: "lxw",
  };
  const extras = state.extraRooms.map((room) => ({
    id: room.id,
    name: room.name,
    floorSqft: extraRoomArea(room),
    wallOrShowerSqft: room.wallOrShowerSqft,
    lengthFt: room.lengthFt,
    widthFt: room.widthFt,
    areaSource: room.areaSource,
  }));
  return {
    job: state.job === "refinish" ? "refinish" : "new",
    family: state.family,
    refinishPackage: state.job === "refinish" ? state.refinishPackage : null,
    installMaterial: state.job === "new" ? (state.family === "tile" ? "tile" : state.installMaterial) : "unknown",
    calcMode: state.calcMode,
    siteFinishSeparate: state.siteFinishSeparate,
    rooms: [primary, ...extras],
    layoutPattern,
    removal: { kind: state.removalKind, areaSqft: state.removalAreaSqft },
    subfloorRepair: { selected: state.subfloorSelected, areaSqft: state.subfloorAreaSqft },
    stairs: { selected: Boolean(state.stairsSelected || roomMode === "stairs"), count: state.stairsCount },
    trimLf: null,
    transitionsCount: null,
    furnitureMoving: state.furnitureMoving,
    productPricePerSqft: state.productPricePerSqft,
    cartonCoverageSqft: state.cartonCoverageSqft,
    flags: {
      ...state.inspectionFlags,
      intricatePattern: layoutPattern === "herringbone" || Boolean(state.inspectionFlags.intricatePattern),
    },
    zip: state.zip,
    streetAddress: state.streetAddress,
    city: state.city,
    applyUnapprovedMinimumPlaceholder: false,
  };
}

function EstimateStep({ snapshot }: { snapshot: string | null }) {
  const { state, patch, roomMode } = useStore();
  const [card, setCard] = useState(() => loadRateCard());
  const [tax, setTax] = useState<TaxResult | undefined>(undefined);

  useEffect(() => {
    const sync = () => setCard(loadRateCard());
    sync();
    window.addEventListener("vipro-rate-card-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vipro-rate-card-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      lookupWaDorTax({ zip: state.zip, streetAddress: state.streetAddress, city: state.city }).then((result) => {
        if (!cancelled) setTax(result);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [state.zip, state.streetAddress, state.city]);

  const input = useMemo(() => toPricingInput(state, roomMode), [state, roomMode]);
  const estimate = useMemo(() => computeEstimate(card, input, tax), [card, input, tax]);

  const scopeLines = useMemo(() => {
    const rows = [{ label: "Work", value: state.job === "refinish" ? "Refinish existing floor" : "New floor" }];
    if (state.family === "tile" && state.job === "new") {
      rows.push({ label: "Floor", value: tileStyles.find((t) => t.id === state.tileStyle)?.label ?? "Tile" });
      rows.push({ label: "Grout", value: grouts.find((g) => g.id === state.grout)?.label ?? "" });
    } else {
      rows.push({ label: "Floor", value: state.job === "refinish" ? "Existing hardwood" : species.find((s) => s.id === state.species)?.label ?? "Hardwood" });
      if (state.job === "new") rows.push({ label: "Pattern", value: patterns.find((p) => p.id === state.pattern)?.label ?? "" });
      if (state.woodMode === "sealer") rows.push({ label: "Sealer", value: sealers.find((s) => s.id === state.sealerId)?.label ?? "" });
      else {
        const stain = stains.find((s) => s.id === state.stainId);
        rows.push({ label: "Stain", value: stain ? `${stain.label} (${stain.code})` : "" });
      }
      rows.push({ label: "Sheen", value: state.sheen === "semi" ? "Semi-gloss" : state.sheen[0].toUpperCase() + state.sheen.slice(1) });
    }
    return rows.filter((r) => r.value);
  }, [state]);

  function updateExtra(id: string, partial: Partial<ExtraRoom>) {
    patch({ extraRooms: state.extraRooms.map((room) => (room.id === id ? { ...room, ...partial } : room)) });
  }

  return (
    <>
      <EstimateResultView estimate={estimate} />
      <p className="section-label">Your choices</p>
      <ul className="scope">
        {scopeLines.map((line) => (
          <li key={line.label}>
            <span>{line.label}</span>
            <strong>{line.value}</strong>
          </li>
        ))}
      </ul>

      <p className="section-label">Project details</p>
      <div className="field">
        <label>ZIP</label>
        <input className="field-input" value={state.zip} inputMode="numeric" autoComplete="postal-code" onChange={(e) => patch({ zip: e.target.value })} />
      </div>
      <div className="field">
        <label>Street address (for destination tax)</label>
        <input className="field-input" value={state.streetAddress} autoComplete="street-address" onChange={(e) => patch({ streetAddress: e.target.value })} />
      </div>
      <div className="field">
        <label>City</label>
        <input className="field-input" value={state.city} autoComplete="address-level2" onChange={(e) => patch({ city: e.target.value })} />
      </div>

      <p className="section-label">Rooms</p>
      <p className="note">Room 1 uses the length and width you already set ({state.lengthFt.toFixed(1)} × {state.widthFt.toFixed(1)} ft · {sqftOf(state)} sq ft). Add more rooms here. Floor area stays separate from shower or wall area.</p>
      {(state.family === "tile" || state.inspectionFlags.showerWaterproofing) && (
        <div className="field">
          <label>Room 1 shower or wall area (sq ft)</label>
          <input className="field-input" type="number" min={0} value={state.wallOrShowerSqft ?? ""} onChange={(e) => patch({ wallOrShowerSqft: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
      )}
      {state.extraRooms.map((room) => (
        <div key={room.id} className="extra-room">
          <input className="field-input" value={room.name} aria-label="Room name" onChange={(e) => updateExtra(room.id, { name: e.target.value })} />
          <div className="split">
            <div className="field">
              <label>Length (ft)</label>
              <input className="field-input" type="number" value={room.lengthFt ?? ""} onChange={(e) => updateExtra(room.id, { lengthFt: e.target.value === "" ? null : Number(e.target.value), areaSource: "lxw" })} />
            </div>
            <div className="field">
              <label>Width (ft)</label>
              <input className="field-input" type="number" value={room.widthFt ?? ""} onChange={(e) => updateExtra(room.id, { widthFt: e.target.value === "" ? null : Number(e.target.value), areaSource: "lxw" })} />
            </div>
          </div>
          <div className="field">
            <label>Or measured floor area (sq ft)</label>
            <input className="field-input" type="number" value={room.floorSqft ?? ""} onChange={(e) => updateExtra(room.id, { floorSqft: e.target.value === "" ? null : Number(e.target.value), areaSource: "manual" })} />
          </div>
          <div className="field">
            <label>Shower or wall area (sq ft)</label>
            <input className="field-input" type="number" value={room.wallOrShowerSqft ?? ""} onChange={(e) => updateExtra(room.id, { wallOrShowerSqft: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <button type="button" className="linkish" onClick={() => patch({ extraRooms: state.extraRooms.filter((item) => item.id !== room.id) })}>Remove room</button>
        </div>
      ))}
      <button
        type="button"
        className="pill"
        onClick={() =>
          patch({
            extraRooms: [
              ...state.extraRooms,
              { id: `room-${Date.now()}`, name: `Room ${state.extraRooms.length + 2}`, lengthFt: null, widthFt: null, floorSqft: null, wallOrShowerSqft: null, areaSource: "lxw" },
            ],
          })
        }
      >
        Add another room
      </button>
      <p className="note">{state.extraRooms.length + 1} room{state.extraRooms.length === 0 ? "" : "s"} · net floor area {estimate.netWorkAreaSqft} sq ft</p>

      {state.job === "new" && (
        <>
          <p className="section-label">Calculation mode</p>
          <div className="pills">
            <button type="button" className={state.calcMode === "installed_package" ? "pill on" : "pill"} onClick={() => patch({ calcMode: "installed_package" })}>Installed package</button>
            <button type="button" className={state.calcMode === "itemized" ? "pill on" : "pill"} onClick={() => patch({ calcMode: "itemized" })}>Itemized</button>
          </div>
          <p className="note">Installed package uses the all-in rate and does not add separate labor. Itemized uses material + labor + selected prep only.</p>
          {state.calcMode === "itemized" && (
            <div className="split">
              <div className="field">
                <label>Product price ($ / sq ft)</label>
                <input className="field-input" type="number" min={0} step="0.01" value={state.productPricePerSqft ?? ""} onChange={(e) => patch({ productPricePerSqft: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Carton coverage (sq ft)</label>
                <input className="field-input" type="number" min={0} value={state.cartonCoverageSqft ?? ""} onChange={(e) => patch({ cartonCoverageSqft: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </div>
          )}
          {state.installMaterial === "solid" && state.calcMode === "itemized" && (
            <label className="consent">
              <input type="checkbox" checked={state.siteFinishSeparate} onChange={(e) => patch({ siteFinishSeparate: e.target.checked })} />
              <span>Unfinished solid hardwood: keep installation and on-site finishing as separate steps</span>
            </label>
          )}
        </>
      )}

      <p className="section-label">Preparation and extras</p>
      <div className="field">
        <label>Existing floor removal</label>
        <select className="field-input" value={state.removalKind} onChange={(e) => patch({ removalKind: e.target.value as State["removalKind"] })}>
          <option value="none">None selected</option>
          <option value="general">General flooring removal</option>
          <option value="tile">Tile demolition</option>
        </select>
      </div>
      {state.removalKind !== "none" && (
        <div className="field">
          <label>Removed area (sq ft)</label>
          <input className="field-input" type="number" min={0} value={state.removalAreaSqft ?? ""} onChange={(e) => patch({ removalAreaSqft: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
      )}
      <label className="consent">
        <input type="checkbox" checked={state.subfloorSelected} onChange={(e) => patch({ subfloorSelected: e.target.checked })} />
        <span>Subfloor repair or leveling</span>
      </label>
      {state.subfloorSelected && (
        <div className="field">
          <label>Affected subfloor area (sq ft)</label>
          <input className="field-input" type="number" min={0} value={state.subfloorAreaSqft ?? ""} onChange={(e) => patch({ subfloorAreaSqft: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
      )}
      <label className="consent">
        <input type="checkbox" checked={state.stairsSelected} onChange={(e) => patch({ stairsSelected: e.target.checked })} />
        <span>Stairs</span>
      </label>
      {state.stairsSelected && (
        <div className="field">
          <label>Stair count or flights</label>
          <input className="field-input" type="number" min={0} value={state.stairsCount ?? ""} onChange={(e) => patch({ stairsCount: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
      )}
      <div className="field">
        <label>Furniture moving</label>
        <select className="field-input" value={state.furnitureMoving} onChange={(e) => patch({ furnitureMoving: e.target.value as State["furnitureMoving"] })}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <p className="section-label">Inspection flags</p>
      {([
        ["engineeredWearLayerUnknown", "Engineered wear layer unknown"],
        ["deepStains", "Deep stains"],
        ["moisture", "Moisture"],
        ["contamination", "Contamination"],
        ["structuralDamage", "Structural damage"],
        ["uncertainRepairs", "Uncertain repairs"],
        ["showerWaterproofing", "Shower waterproofing"],
        ["premiumMaterials", "Premium materials"],
        ["unusualConditions", "Unusual conditions"],
      ] as const).map(([key, label]) => (
        <label key={key} className="consent">
          <input
            type="checkbox"
            checked={Boolean(state.inspectionFlags[key])}
            onChange={(e) => patch({ inspectionFlags: { ...state.inspectionFlags, [key]: e.target.checked } })}
          />
          <span>{label}</span>
        </label>
      ))}

      <p className="section-label">Request an on-site quote</p>
      <p className="note">Revise any choice above, then send a visit request. This remains a preliminary estimate.</p>
      <LeadForm snapshot={snapshot} />
      <p className="note">
        {brand.serviceArea} · <a href={`tel:${brand.phoneTel}`}>{brand.phoneDisplay}</a>
      </p>
    </>
  );
}

function pathSteps(state: State) {
  if (state.job === "refinish") {
    return [
      { label: "Finish", step: 2 },
      { label: "Estimate", step: 3 },
    ];
  }
  return [
    { label: "Floor", step: 1 },
    { label: "Finish", step: 2 },
    { label: "Estimate", step: 3 },
  ];
}

function Panel({ snapshot }: { snapshot: string | null }) {
  const store = useStore();
  const { state } = store;
  const chooser = state.step === 0;
  const showContinue = state.step === 2;
  const canContinue = sqftOf(state) > 0;
  const dots = pathSteps(state);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [state.step, store.roomMode]);
  return (
    <aside className={chooser ? "panel chooser" : "panel"}>
      <div className="panel-scroll" ref={scroller}>
        {!chooser && (
          <div className="panel-bar">
            <button type="button" className="back" onClick={store.back}>
              Back
            </button>
            <ol className="dots" aria-label="Steps">
              {dots.map((item, i) => (
                <li key={item.label}>
                  {i > 0 && <i />}
                  <button
                    type="button"
                    className={item.step === state.step ? "on" : ""}
                    aria-label={item.label}
                    aria-current={item.step === state.step ? "step" : undefined}
                    onClick={() => store.setStep(item.step)}
                  />
                </li>
              ))}
            </ol>
          </div>
        )}
        {state.step === 0 && <WorkStep />}
        {state.step === 1 && <FloorStep />}
        {state.step === 2 && store.roomMode === "pick" && <RoomPicker />}
        {state.step === 2 && store.roomMode && store.roomMode !== "pick" && (
          <>
            <RoomControls roomId={store.roomMode} />
            <FinishStep />
          </>
        )}
        {state.step === 2 && !store.roomMode && <FinishStep />}
        {state.step === 3 && <EstimateStep snapshot={snapshot} />}
      </div>
      {showContinue && (
        <div className="foot">
          {state.step === 2 && !store.roomMode && (
            <button type="button" className="secondary" onClick={() => store.setRoomMode("pick")}>
              See it in a room
            </button>
          )}
          <button type="button" className="continue" disabled={!canContinue} onClick={store.next}>
            Get estimate
          </button>
        </div>
      )}
    </aside>
  );
}


function moneyShort(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function PricePill() {
  const { state, setStep, roomMode } = useStore();
  const [card, setCard] = useState(() => loadRateCard());
  useEffect(() => {
    const sync = () => setCard(loadRateCard());
    sync();
    window.addEventListener("vipro-rate-card-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vipro-rate-card-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const estimate = useMemo(() => computeEstimate(card, toPricingInput(state, roomMode)), [card, state, roomMode]);
  const low = estimate.incompleteLow || estimate.subtotalLow == null || !Number.isFinite(estimate.subtotalLow) ? null : estimate.subtotalLow;
  const high = estimate.incompleteHigh || estimate.subtotalHigh == null || !Number.isFinite(estimate.subtotalHigh) ? null : estimate.subtotalHigh;
  const unpriced = (low == null && high == null) || (low === 0 && (high == null || high === 0));
  const label = unpriced
    ? "Needs assessment"
    : low != null && high == null
      ? `Est. ${moneyShort(low)}–Needs assessment`
      : low == null && high != null
        ? `Needs assessment–${moneyShort(high)}`
        : `Est. ${moneyShort(low as number)}–${moneyShort(high as number)}`;
  const sized = `${state.lengthFt} × ${state.widthFt} ft · ${sqftOf(state)} sq ft`;
  return (
    <button type="button" className={unpriced ? "price-pill needs" : "price-pill"} onClick={() => setStep(3)} aria-label="Open full estimate breakdown">
      <span>{label}</span>
      <small>{sized}</small>
    </button>
  );
}

function Shell() {
  const store = useStore();
  const capture = useRef<(() => string) | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [reduce, setReduce] = useState(false);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [gl, setGl] = useState<"wait" | "ok" | "no">("wait");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const mobile = window.matchMedia("(max-width: 800px)").matches;
    setQuality(memory <= 2 || (mobile && memory <= 4) ? "low" : "high");
    try {
      const c = document.createElement("canvas");
      setGl(c.getContext("webgl2") || c.getContext("webgl") ? "ok" : "no");
    } catch {
      setGl("no");
    }
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (store.state.step !== 3) return;
    const wait = store.anim ? 1600 : 400;
    const id = window.setTimeout(() => {
      const shot = capture.current?.() ?? null;
      if (shot) setSnapshot(shot);
    }, wait);
    return () => window.clearTimeout(id);
  }, [store.anim, store.state]);

  return (
    <main className={store.state.step === 0 ? "shell chooser" : "shell"}>
      {store.state.step > 0 && <div className="stage">
        <PricePill />
        {gl === "no" ? (
          <div className="stage-fallback">
            <p>This browser can&apos;t draw the floor sample. The choices below still work.</p>
          </div>
        ) : gl === "ok" ? (
          <FloorStage
            state={store.state}
            anim={store.anim}
            nonce={store.nonce}
            reduceMotion={reduce}
            onAnimDone={store.finishAnim}
            onSkip={store.skipAnim}
            onView={store.setView}
            captureApi={capture}
            quality={quality}
            layout={store.roomMode && store.roomMode !== "pick" && roomById(store.roomMode) ? "room" : "sample"}
            roomId={store.roomMode && store.roomMode !== "pick" ? store.roomMode : undefined}
            ghost={store.ghost}
            evening={store.evening}
            showRug={store.showRug}
          />
        ) : (
          <div className="stage-fallback">
            <p>Setting the sample…</p>
          </div>
        )}
      </div>}
      <Panel snapshot={snapshot} />
    </main>
  );
}

export function EstimatorApp() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
