# VIPRO Floor Estimator — Engineering Handoff (v0.22)

*Prepared Nov 10, 2026 for the next engineer or AI agent. Read this whole file before you change anything.*

> **Security:** This document has no secrets in it: no admin password, no tokens, no env values. Section 3.6 says where each secret is configured. Don't paste a secret into code, commits, docs, screenshots or chat.

---

## 0. TL;DR

- **What it is:** a mobile-first 3D floor estimator for Vlad, a hardwood refinishing and installation contractor in Seattle and on the Eastside. The brand is **Rhino Lab**, and "**VIPRO**" is only a temporary site name. The flow is: choose a service → choose a floor (material, species, pattern, coating/stain, sheen) → enter L × W → see it in one of 11 dollhouse 3D rooms → get a price range.
- **State:** v0.22 is on a **preview** deployment. Production is still on v10. **Don't promote anything without the owner's explicit OK.**
- **Pricing:** every rate is a **provisional benchmark** and is not approved by Vlad. Real prices are still pending. **Never invent prices.**
- **Tests:** 50 tests, all passing (`npm test`).

---

## 1. Product overview

| | |
|---|---|
| Client | Vlad, a hardwood floor refinishing and installation contractor |
| Brand | Rhino Lab. "VIPRO" (`config/brand.ts → logoText`) is a temporary site name and must be easy to rename everywhere. |
| Audience | Homeowners in Seattle and on the Eastside (Bellevue, Kirkland, Redmond, …) |
| Owner / product decision-maker | David Zuev. He approves all visual and pricing changes and any production promotion. |
| Business phone in config | (206) 670-7005 (`config/brand.ts`) |

### User flow
1. **Service:** *Refinish* (sand and refinish an existing floor) or *New floor* (installation). Refinish skips the hardwood/tile chooser.
2. **Floor:**
   - New floor → Hardwood or Tile.
   - Hardwood → species (white oak, red oak, walnut, maple) → pattern (straight, herringbone, chevron) → coating/stain (Bona sealers: NordicSeal, NaturalSeal, ClassicSeal, IntenseSeal, AmberSeal; 14 DuraSeal-style stains with codes) → sheen (matte, satin, semi-gloss, gloss).
   - Tile → tile style. Each style has its real tile size (`config/products.ts → tileStyles`).
3. **Size:** length × width sliders in feet. **Area comes only from L × W**; there is no separate sq-ft question.
4. **Rooms:** see the floor inside 11 dollhouse 3D rooms. The "Room visibility" slider runs from 0% (floor only) to 100% (full room).
5. **Estimate:** a price pill is always visible and updates instantly. It opens the full estimate, which is labeled **"Preliminary estimate, subject to measurement and inspection."** A lead form exists, but delivery is **off** (`config/lead.ts → lead.enabled = false`, no CRM webhook connected).
6. **Admin** (`/admin`): password-gated rate-card editor. It saves to browser localStorage and can export JSON (see §4.7).

---

## 2. Current state (v0.22)

| Item | Value |
|---|---|
| Version | `0.22.0` (`src-v5/package.json`) |
| **Preview URL (v0.22)** | https://vipro-floor-3d-454rqo2dk-pcpshow1-2216s-projects.vercel.app |
| **Preview deployment id** | `dpl_FETs9VMWPYdwAM8HN1uHyWzgRR8c` (created Nov 10, 2026, 9:47 PM PST) |
| **Production alias** | https://vipro-floor-3d.vercel.app → still **v10**, `dpl_E4k2t2wVNEqGWjnKUiMo6Fcd2nJH` |
| Vercel project | `vipro-floor-3d` (`prj_zdDU39XqVDLAUy8CohKNyILA9UkD`) |
| Vercel team | `pcpshow1-2216s-projects` (`team_Hle2cpjmnFjMSu3nwua9u7Jl`) |
| Promotion policy | **Don't promote to production or re-alias without the owner's explicit OK.** |

### Hard rules
- Work only on Vercel project **vipro-floor-3d**. **Don't touch** `vipro-flooring-estimator`, `vipro-preview`, or `deck.rhinolab.app`. Those belong to other workstreams.
- Deploy **previews only**: no `target`, and `forceNew=1`.
- **No invented prices**, source URLs, credentials, testimonials or business claims.
- Don't contact customers or Vlad, and don't post anything publicly.

---

## 3. Tech stack & architecture

### 3.1 Stack
- **Next.js 14.2** App Router with static export (`output: "export"`, `trailingSlash: true`, `images.unoptimized`), React 18, TypeScript.
- **3D:** `@react-three/fiber` 8, `@react-three/drei` 9, `three` 0.170.
- **Admin gate:** `scrypt-js`, client side only (see §3.6).
- **Tests:** Node test runner via `tsx --test`.
- **Assets:**
  - Kenney Furniture Kit 2.0 (CC0) in `public/models/kenney`; license in `public/credits/`.
  - PBR-ish textures in `public/textures/`.
  - HDR environments in `public/hdr/` (`studio.hdr`, `room.hdr`).
  - Montserrat in `public/fonts/`.

### 3.2 Folder tree (src-v5)
```
src-v5/
├─ app/
│  ├─ page.tsx            # mounts <EstimatorApp/>
│  ├─ layout.tsx          # fonts, metadata
│  ├─ globals.css         # all styling (mobile-first + landscape layout)
│  └─ admin/page.tsx      # mounts <AdminApp/>
├─ components/
│  ├─ EstimatorApp.tsx    # flow/state store, steps, PricePill, room picker, "Room visibility" slider,
│  │                      # builds pricing input, listens for "vipro-rate-card-changed"
│  ├─ FloorStage.tsx      # <Canvas>, floor shader (MeshPhysicalMaterial + onBeforeCompile,
│  │                      # cache key "vipro-sample-v12"), instanced planks/tiles, FloorGlow
│  │                      # (MeshReflectorMaterial for gloss), lights, CameraRig + fitRoomCamera
│  ├─ RoomShell.tsx       # architecture: walls, windows, door, curtains, wainscot, procedural living
│  │                      # room (sofa, chaise, fireplace + mantel TV, art, rug, lamp, plant),
│  │                      # open-plan stub wall, stair geometry/rail, chandelier
│  ├─ RoomFurniture.tsx   # Kenney GLB placement + recolor (neutralizeMaterial / FAMILY_LOOK),
│  │                      # procedural VanityCabinet, WallMirror, Towel, Shoes
│  ├─ EstimateResult.tsx  # full estimate view (lines, flags, "Needs assessment", tax state)
│  └─ AdminApp.tsx        # password gate + rate-card editor, export JSON, reset defaults
├─ config/
│  ├─ rooms.ts            # 11 rooms, roomProfiles (wall colour, wallH, windows, curtains…),
│  │                      # visualSpecs + visualFeet(id, L, W)
│  ├─ stairs.ts           # straight flight (turn=false); L-turn code kept but disabled
│  ├─ products.ts         # species, patterns, stains (14 + codes), sealers, sheens, tileStyles
│  ├─ default-rate-card.ts# shipped provisional rate card (all approved:false)
│  ├─ pricing.ts          # pricingMeta (approved:false, disclaimer)
│  ├─ brand.ts            # logoText "VIPRO", phone, service area
│  ├─ lead.ts             # lead form config (enabled:false; no webhook)
│  ├─ admin-gate.ts       # scrypt HASH + salt + params only (no plaintext)
│  └─ rooms-data.json
├─ lib/
│  ├─ pricing/engine.ts   # computeEstimate() — the pricing engine
│  ├─ pricing/types.ts    # RateCard, RateRange, EstimateInput/Result, flags
│  ├─ pricing/store.ts    # localStorage "vipro-rate-card-v1": load/save/reset (+ change event)
│  ├─ pricing/auth.ts     # verifyAdminPassword (scrypt), session key "vipro-admin-ok"
│  ├─ pricing/tax.ts      # WA DOR AddressRates lookup + parse + interpret
│  ├─ room-layout.ts      # SINGLE SOURCE OF TRUTH for room geometry/furniture layout + collisions
│  ├─ layout.ts           # plank/tile layout helpers
│  └─ homography.ts       # legacy (photo-compositing era), unused by the 3D path
├─ public/
│  ├─ config/rate-card.json   # reference copy of the rate card (NOT loaded at runtime)
│  ├─ credits/                # MODELS.md, KENNEY-FURNITURE-KIT-LICENSE.txt
│  ├─ hdr/ models/kenney/ textures/ thumbs/ fonts/
│  └─ photos/jobs, photos/rooms   # LEGACY from rejected photo-compositing; candidates to delete
├─ tests/
│  ├─ pricing-engine.test.ts  # 14
│  ├─ tax.test.ts             # 3
│  └─ collision.test.ts       # 33
├─ next.config.mjs, tsconfig.json, package.json
```

### 3.3 Key concepts in the 3D code
- **Real-size materials.** Planks and tiles keep their real physical size. When L × W grows, the **count** grows and the texture never stretches. Floors are instanced meshes.
- **Display size vs priced size.** `visualFeet(id, L, W)` (config/rooms.ts) maps the typed size to a display size for each room type (for example, bathroom base 8 × 6.4 ft, growth 0.12, clamped between 6.5 × 5.6 and 10 × 8.2). This keeps a small bathroom looking like a bathroom. **Pricing always uses the typed L × W.** In meters: `spanX = visualLength × 0.3048`, `spanZ = visualWidth × 0.3048`. Stairs use `stairWellFromFeet` (hallW / hallL).
- **`lib/room-layout.ts` is the single source of truth:**
  - `windowCenters`
  - `roomOpenings`: back-wall windows, and a left-wall door at `z = hz − 0.58`, `DOOR_W 0.9`, `DOOR_H 2.08`
  - `placeOnWall` / `placeFittedOnWall`: avoid windows and doors, with a 0.26 m curtain pad on the back wall when the profile has curtains
  - `layoutBoxes`, `poseOf`
  - `detectCollisions`

  Render components ("Follow" components) reposition items every frame from these spans. **Always change placement here, never with ad-hoc offsets in a component.** The collision tests depend on it.
- **Camera.** `fitRoomCamera(sx, sz, aspect, fov, wallH, roomKey)` in FloorStage.tsx gives a dollhouse framing for every non-stair room:
  - `extentY = max(wallH×0.38 + hypot×0.44, wallH×0.92)`
  - `extentW = max(hypot(sx,sz)×0.56, wallH×1.02)`
  - pad 1.16 landscape / 1.32 portrait (stairs 1.22 / 1.32)
  - minDist 4.5 (stairs 4.2)
  - look-at Y = `wallH×0.34` for small rooms (hypot < 2.2), otherwise `wallH×0.26`

  The wall-height floor on the extents is there so small rooms (bathroom, laundry, entry) never get a too-close camera. That was the v0.21 regression.
- **Floor shader.** MeshPhysicalMaterial patched with onBeforeCompile; `customProgramCacheKey = "vipro-sample-v12"`. Bump this key whenever you change the shader source. Gloss uses `FloorGlow` (MeshReflectorMaterial) together with the `studio.hdr` environment.
- **Furniture.** Kenney GLBs are recolored to neutral, realistic finishes (`neutralizeMaterial`, `FAMILY_LOOK`), never pink or toy-like. Procedural parts are the vanity cabinet (countertop at 0.76 m) with the mirror centered at `vanityTop + 0.15 + 0.34`, plus towels, shoes, the living-room set and the fireplace.

### 3.4 Run / test / build
```bash
cd src-v5
npm ci                 # or npm install
npm run dev            # next dev  → http://localhost:3000  (admin at /admin)
npm test               # tsx --test tests/pricing-engine.test.ts tests/tax.test.ts tests/collision.test.ts
npm run build          # next build → static site in ./out
npx tsc --noEmit       # type-check
# local static check of the export:
python3 -m http.server 4178 -d out   # then open http://127.0.0.1:4178/
```
Node 18 or 20 works. Use `/usr/bin/google-chrome` with Playwright for screenshots.

### 3.5 Deploy a **preview** (never production)
This project is deployed as a prebuilt static `out/` folder, with no build step on Vercel.
1. `npm test && npm run build`.
2. Compute the SHA1 of each file in `out/` and upload the new files to Vercel (Vercel REST `POST /v2/files` with `x-vercel-digest`, or the Vercel MCP `upload_file`).
3. Create the deployment (Vercel REST `POST /v13/deployments?teamId=team_Hle2cpjmnFjMSu3nwua9u7Jl&forceNew=1&skipAutoDetectionConfirmation=1`). Body:
   ```json
   { "name": "vipro-floor-3d", "project": "vipro-floor-3d",
     "files": [{ "file": "index.html", "sha": "<sha1>", "size": 1234 }, "..."],
     "projectSettings": { "framework": null, "buildCommand": "", "installCommand": "", "outputDirectory": "." },
     "meta": { "version": "0.23" } }
   ```
   **No `target` field.** Leaving it out is what keeps the deployment a preview.
4. Poll until `READY`. Then **check that `vipro-floor-3d.vercel.app` still points to `dpl_E4k2t2wVNEqGWjnKUiMo6Fcd2nJH`** (or to whatever the owner last approved).
5. Alternative with the CLI: `npx vercel deploy out --prebuilt`-style preview deploy (**never** `--prod`), scoped to the team.

### 3.6 Secrets: where they live (values deliberately left out)
| Secret | Where it's configured | Notes |
|---|---|---|
| Admin password (plaintext) | Outside the repo, in the owner's private secrets file on the build machine (`~/.secrets/vipro-admin.env`). Ask the owner, David, if you need it. | Never print, commit, log or screenshot it. |
| Admin password hash | `src-v5/config/admin-gate.ts`: scrypt hash + salt, params N=16384, r=8, p=1 | This is a hash, not the password. It ships in the client bundle, so the gate is **convenience only, not real security**. To rotate: generate a new salt and scrypt hash with the same params locally, replace the fields, rebuild, redeploy a preview. |
| Vercel access | The deploying user's Vercel account/token. Never stored in the repo. | Use your own authorized session. |
| CRM / lead webhook | Not configured. It would go in `config/lead.ts` (or better, a server env var). | Lead delivery is disabled. |

The source zip has no `.env` files.

---

## 4. Pricing engine spec (`lib/pricing/engine.ts → computeEstimate`)

> **Every rate is provisional.** They are David Zuev's local planning benchmarks dated Nov 10, 2026 (`approved: false` everywhere, `pricingMeta.approved = false`, `approvedByVlad = false`). **Real prices from Vlad are pending.** The **$1,800 tile/small-job minimum is an unapproved placeholder.** **Stairs have no rate.** Never invent or "fill in" a rate. Missing values must surface as **"Needs assessment"**.

### 4.1 Inputs
- Rooms: each with `floorSqft = L × W` (from the sliders). Wall and shower tile area is a separate input and is never added to floor area.
- Service: `refinish` or `new`.
- For refinish: package (`screen_recoat`, `full_sand_natural` or `full_sand_stained`). Stain → stained package.
- For new: family (hardwood: engineered/solid; tile), pattern, mode (A or B), optional product price and carton coverage.
- Extras: removal, tile demo, subfloor repair/leveling, stairs, trim, transitions, furniture moving, mobilization, etc. Only the ones selected count.
- Tax: optional street address + ZIP, or an admin override.

### 4.2 Core rules
- **Net area** = sum of the rooms' `floorSqft`. Wall and shower area stay separate.
- **Refinish:** exactly **one** package × net area. Packages are alternatives and are never added together.
- **Mode A, `installed_package`:** net area × installed package rate (engineered $9–16, solid site-finished $11–20, ceramic/porcelain tile $14–28).
  - Material type is **never guessed**. Unknown → flag `missing`.
  - Parquet → **assessment** (no rate). Herringbone or another intricate pattern: the base area is still priced, and a separate "herringbone surcharge" line is flagged **Needs assessment**, because no surcharge is configured.
  - No separate labor or material lines. An entered product price is **ignored**, with an info flag.
- **Mode B, `itemized`** (engineered/solid):
  - Labor = `prefinished_labor_only` ($3.25–5+, high end open) × net area.
  - Material = product price × **order quantity**. Order quantity = net × (1 + waste), rounded up to whole cartons when carton coverage is given.
  - Missing product price → `missing` flag.
  - Tile labor in Mode B → **assessment**.
- **Waste:** straight lay 7–10%; diagonal or herringbone 12–15% (`wasteBand()` in engine.ts; other patterns use straight). Applies **only to material order quantity**, never to labor or to installed-package quantities.
- **Extras:** priced only when selected, using actual areas. Removal and subfloor need an area. `assessExtra` turns null-rate extras into assessment flags and **never prices them at $0**. Tile demolition has an open high end ($3.50–assessment).
- **Minimum** (`smallJob`, $1,800, `placeholder:true`, `approved:false`, `applyOnceTo: selected_package_scope`):
  - Applied **once per estimate, never per room**: `adjusted = max(subtotal, minimum)`.
  - Only applied if the minimum is approved and not a placeholder, **or** if `applyUnapprovedMinimumPlaceholder` is true. The UI passes `false`.
  - Otherwise an info flag shows what the illustrative minimum would be.
- **Contingency:** disabled (null percents).
- **Totals:** sum of known lines.
  - If any line has an unknown low or high, `incompleteLow` / `incompleteHigh` is set and that side shows **"Needs assessment"**.
  - The engine never returns NaN, a negative value, or a misleading $0.
- **Headline label:** "Preliminary estimate, subject to measurement and inspection". The rate-card disclaimer is shown too.

### 4.3 Tax (`lib/pricing/tax.ts`)
- Source: WA DOR AddressRates URL interface, `https://webgis.dor.wa.gov/webapi/AddressRates.aspx` (docs: https://dor.wa.gov/wa-sales-tax-rate-lookup-url-interface). `parseDorText` parses the text output and `interpretDorLookup` decides whether to apply it.
- Applied **only when confirmed**:
  - Result codes **0, 2, 3, 4** with a **street address** → confirmed; the rate is applied.
  - Code **5** (ZIP-only match) or a ZIP-only input → **not applied**, shown as "tax not included / to be confirmed".
  - Codes **1, 6, 7, 9** → unconfirmed, not applied.
- An **admin override** (`tax.overrideRate` with `overrideConfirmed: true`) wins over the lookup. Default: `overrideRate: null`, `overrideConfirmed: false`.

### 4.4 Rate card (shipped defaults, `config/default-rate-card.ts`)
Metadata:
- `source`: "David Zuev provisional benchmarks, Nov 10 2026"
- `asOf`: 2026-11-10
- `serviceArea`: "Seattle and the Eastside"
- `approvedByVlad`: false
- Disclaimer: *"Preliminary estimate, subject to measurement and inspection. These ranges are provisional local planning benchmarks, not VIPRO quotes. Vlad has not approved a price list."*

| Key | Low | High | Unit | Notes |
|---|---|---|---|---|
| screen_recoat | 2.00 | 3.50 | $/sq ft | refinish package |
| full_sand_natural | 4.00 | 7.00 | $/sq ft | refinish package |
| full_sand_stained | 5.00 | 8.00 | $/sq ft | refinish package |
| prefinished_labor_only | 3.25 | 5.00+ | $/sq ft | `highIsOpen` |
| engineered_installed | 9.00 | 16.00 | $/sq ft | Mode A |
| solid_installed_site_finished | 11.00 | 20.00 | $/sq ft | Mode A |
| ceramic_porcelain_floor_tile_installed | 14.00 | 28.00 | $/sq ft | Mode A |
| general_flooring_removal | 1.00 | 3.00 | $/sq ft | extra |
| tile_demolition | 3.50 | null | $/sq ft | high requires assessment |
| subfloor_repair_leveling | 3.00 | 8.00 | $/sq ft | extra |
| parquet, herringbone | null | null | — | requires assessment |
| stairs | null | null | per item | **no rate**, assessment |
| shower_waterproofing, premium_materials, major_repairs, unusual_conditions | null | null | — | assessment |
| trim | null | null | per lf | assessment |
| transitions | null | null | per item | assessment |
| furniture_moving, mobilization | null | null | fixed | assessment |
| smallJob minimum | 1800 | — | fixed | **placeholder, unapproved** |

**RateRange fields:** `id`, `label`, `low`, `high`, `highIsOpen`, `units` (`usd_per_sqft` / `usd_per_lf` / `usd_per_item` / `fixed`), `scope`, `inclusions`, `exclusions`, `source`, `sourceUrl`, `asOf`, `approved`, `notes`, `requiresAssessment`, `placeholder`.

### 4.5 The four spec scenarios (covered by tests)
1. 500 sq ft **natural refinish** → **$2,000–$3,500**.
2. 500 sq ft **stained refinish** → **$2,500–$4,000**.
3. 1,000 sq ft **engineered installed** (Mode A) → **$9,000–$16,000**. Material order quantity is 1,070–1,100 sq ft, but **no waste** is applied to the installed package.
4. 45 sq ft **tile bathroom** → 45 × $14–28 = **$630–$1,260**. The placeholder minimum shows an *illustrative* $1,800 info flag and is not applied. With `applyUnapprovedMinimumPlaceholder=true`, $1,800 is applied **once** (also checked across two rooms).

### 4.6 UI copy rules
- Always show "Preliminary estimate, subject to measurement and inspection."
- Show "Needs assessment" for any incomplete side, never $0.
- Open-ended lines are shown as "from $X".
- Customer-facing text must not hard-code Vlad's name or claims about Seattle. Longer notes are **admin-only**.

### 4.7 Admin overrides
- `/admin` checks the password against the scrypt hash and sets the session flag `sessionStorage["vipro-admin-ok"]`.
- Edits are saved to **`localStorage["vipro-rate-card-v1"]`**, in that browser only. `loadRateCard()` deep-merges them over the shipped defaults. `saveRateCard` / `resetRateCard` dispatch the `vipro-rate-card-changed` window event, and EstimatorApp recalculates live.
- **Download JSON** exports `vipro-rate-card.json`. To make admin prices the shipped defaults, copy the values into `config/default-rate-card.ts`, rebuild, and deploy a preview. This should happen only after Vlad provides real prices and the owner approves.
- `public/config/rate-card.json` is a reference copy only and isn't read at runtime.

---

## 5. 3D / visual rules and David's preferences (follow these)
1. **Realism over animation; quality over speed.** "Fewer features, but crisp."
2. Boards and tiles **keep their real size**. Resizing adds boards and tiles and never stretches.
3. The lay-in/cascade animation plays **only when the material or pattern changes**, never on resize. On resize the pattern just extends smoothly.
4. Clicking a stain/color swatch **recolors the floor immediately** and moves the light↔dark slider to match.
5. **Gloss** must show a clear ceiling/light reflection: the small, realistic overhead triangle/lamps, plus chandelier and window light on the floor. Today gloss reads more like a tint than a mirror, so this needs improvement.
6. **No** top Floor / Close-up / icon controls. Only the floor and rooms.
7. **Landscape must work** as well as portrait.
8. Area comes from **L × W only**.
9. The **Room visibility** slider runs 0–100%. Rooms **scale with the floor**, and they should look furnished, not like skeletons.
10. **Photo compositing was rejected.** Use dollhouse 3D rooms with real perspective and lighting.
11. **Stairs are an accent.** Use a narrow stairwell, not a big room, with treads in the live floor material and white risers.
12. Rooms should look **different from each other**. Recolors should be neutral and realistic, **never pink or toy-like**.
13. **Walnut** should read as a cool chocolate, not orange.
14. **Refinish skips** the hardwood/tile chooser. The Refinish and New floor cards must look clearly different (sanding vs installation).
15. UI is a white/black minimal foundation. Natural wood colors belong only in samples and the floor.
16. **No invented prices**, claims, testimonials or URLs.
17. Every visual change needs screenshots in portrait (390×844 @2x) and landscape (1280×800) of all 11 rooms, and **you must look at every one yourself**.

---

## 6. Room-by-room status (v0.22)

The typed sizes tested are 12×10, 18×14 and 24×20 ft. All 11 rooms × 3 sizes pass the collision tests.

| # | Room | Contents | Status | Known weak points |
|---|---|---|---|---|
| 1 | Living room | Procedural sectional + chaise, rug, fireplace with mantel TV, floor lamp, side table, art on a window-free pier, plant, chandelier, curtains | ✅ Best room | The furniture style is still a bit stylized |
| 2 | Kitchen | Kenney base/upper cabinets, sink, stove + hood, fridge, island + stools, plant | ⚠️ OK | Sparse, Kenney look; needs backsplash, pendants and counter props |
| 3 | Dining | Table + 4 chairs, sideboard, chandelier, plant | ✅ Good | Could use a rug and art |
| 4 | Bedroom | Bed, 2 nightstands + lamps, bookcase (wide sizes), plant, accent wall | ✅ Good | Bedding is low-detail |
| 5 | Bathroom (tile by default) | Procedural vanity + sink with mirror directly above, toilet, shower stall, towels, wainscot tile | ⚠️ Fixed in v0.22 (framing, vanity) | Small in portrait and somewhat sparse. Tub removed (it clipped the wall). |
| 6 | Entry / foyer | Console, bench, coat rack, wall hooks, shoes, runner, plant, tall window | ✅ Good | — |
| 7 | Stairs | Straight flight, live-material treads, white risers, stringers, balusters, newels, landing, art, plant | ✅ Accent | **L-turn disabled** (`config/stairs.ts turn=false`): the second flight floated or poked through the upper-right wall |
| 8 | Home office | Desk, monitor, laptop, chair, bookcase, floor lamp, plant | ✅ Good | — |
| 9 | Basement | Lower walls, beams/joists, sofa, coffee table, plant | ⚠️ OK | Beams read as heavy slabs at the open front edge |
| 10 | Open living + kitchen | L-shaped floor, kitchen run + island + stool, sofa + coffee table + rug, stub wall | ✅ OK | Zones feel a little disconnected |
| 11 | Laundry / mudroom (tile by default) | Washer, dryer, bench, plant | ⚠️ OK | Sparse; needs shelving/cabinets above the machines |

Latest screenshots are on the build machine in `screenshots-room-v22/{landscape,portrait}/`. They are not in the zip, so regenerate them yourself.

---

## 7. Backlog (prioritized)

**P0: blocked on business input (don't guess)**
1. Get Vlad's real price list. Replace the provisional rates and set `approved:true` with a real `source` and `asOf`.
2. Decide the minimum charge (the $1,800 placeholder) and a stair rate (per tread/riser) with Vlad.
3. Decide the final brand/site name (Rhino Lab vs "VIPRO") and replace `logoText` and copy everywhere.
4. Connect lead delivery to a CRM through a **server-side** endpoint with an env-var secret, then enable `lead.enabled`.

**P1: visual quality**
5. Make gloss a real mirror-like reflection (stronger reflector mix and a sharper ceiling/light reflection on semi-gloss and gloss) without hurting mobile performance.
6. Bathroom: larger in portrait, plus a bathtub that fits properly (respect walls and the door), a glass shower door, and accessories.
7. Kitchen: backsplash, pendant lights, counter props, cabinets that read as built-in. Laundry: upper cabinets/shelf, basket.
8. Basement: thinner beams that stop short of the open front edge, or that fade with the visibility slider.
9. Re-enable L-turn stairs, with the landing and second flight properly attached to the walls, and add a collision test.
10. Replace or upgrade the stylized Kenney furniture with more realistic CC0 models or procedural pieces. Keep recolors neutral.

**P2: UX / tech**
11. Portrait: the stain chip row can clip while scrolling. Fix spacing and sticky behavior.
12. Delete the legacy photo assets (`public/photos/jobs`, `public/photos/rooms`) and `lib/homography.ts` once confirmed unused, to shrink the bundle.
13. Performance pass: texture sizes, KTX2/meshopt for GLBs, lazy-load rooms.
14. Move the admin gate server side (it is client-only today) and store the rate card server side so it isn't per browser.
15. Accessibility: focus states, aria labels on swatches and sliders.

**Ideas**
- A saved/shareable estimate link (with proper access control, and no customer PII by default).
- Compare two finishes side by side.
- An "upload a photo of your floor" CTA for the lead form.

---

## 8. Tests (50 total; `npm test`)
- `tests/pricing-engine.test.ts` (14):
  - the 4 spec scenarios
  - no double-counting (stairs, waste, unknown extras)
  - itemized labor + material
  - missing inputs flagged
  - stairs → assessment; admin-entered stair rate is used
  - tile demo has an open high end
  - parquet and itemized tile → assessment
  - confirmed tax + admin override
  - wall/shower area kept separate
  - a combo sweep that never returns NaN or $0
- `tests/tax.test.ts` (3): parses DOR text; ZIP-only is not confirmed; address-level is confirmed.
- `tests/collision.test.ts` (33): 11 rooms × 3 typed sizes. No furniture overlaps, nothing blocks the door or windows, and everything is inside the walls (uses `layoutBoxes` / `detectCollisions` from `lib/room-layout.ts`).

**Adding tests:** create `tests/<name>.test.ts` using `node:test` + `node:assert/strict`, import from `@/lib/...` or relative paths, and **add the file to the `test` script in package.json** (the files are listed explicitly). For new furniture, add it to `layoutBoxes` in `room-layout.ts` so the collision test covers it automatically. For pricing, assert on exact `low`/`high`, the flags, and `incompleteLow/High`.

---

## 9. Version history

The production alias has been on v10 since Nov 10, 2026, 5:31 PM PST. Everything after it is preview only. Times are PST.

| Version | Deployment id | Target | Created | Highlights |
|---|---|---|---|---|
| v1–v9 | dpl_6rS3vzGF…, dpl_DUfvobap…, dpl_8gojRTKq…, dpl_RsuhJNgw…, dpl_82rwtEcn…, dpl_BoRbJHbm…, dpl_88RLm5zi…, dpl_BidM2KnM…, dpl_GuCMiQVY… | production | Nov 9 4:30 PM → Nov 10 5:20 PM | Early concepts: floating sample (concept C), photo-compositing attempt (rejected), L × W sliders |
| **v10** | `dpl_E4k2t2wVNEqGWjnKUiMo6Fcd2nJH` | **production (current alias)** | Nov 10 5:31 PM | Floating floor sample estimator |
| v11–v0.16 (5 previews, chronological) | `dpl_53UntdArKzsDsUDPjzszqcmwsmW1` (5:39 PM), `dpl_AeZyErUdiLrU4h1Dk1utRTcZWAsX` (6:12 PM), `dpl_FqKwsYCiDkZs3A7sSn7uzLCCRRra` (6:58 PM), `dpl_DANRmWdvuh4qbYZWwDrqWMJgiAyn` (7:13 PM), `dpl_BBLLNpPdtYMZ6m7QrsjVaii4YDGa` (7:31 PM) | preview | Nov 10 | 3D room mode, room visibility slider, rooms scale with the floor, real-size planks, gloss reflection restored, controls removed, landscape fix. The exact version ↔ id mapping in this range wasn't recorded; the order is chronological. |
| v0.17 | `dpl_5wa2szAQqanApwmPNJpgPomb6djw` | preview | 7:46 PM | Ghost/visibility slider, lighting, more rooms, always-visible price pill |
| v0.18 | `dpl_5aRDjWcsuj5acKgXo2Vqu72YL1st` | preview | 8:11 PM | Better living room, stairs as accent (narrow stairwell), rooms less alike, realistic overhead triangle |
| v0.19 | `dpl_FSnGNEJrvYLJnc8HVGp4f6wahiPZ` | preview | 8:50 PM | Eight-item polish pass; pricing engine v2 (modes A/B, waste, assessment flags, DOR tax) |
| v0.20 | `dpl_DVGcMffnFpLRrtwqXDUxPodYnjvQ` | preview | 9:07 PM | Max graphics pass on all elements and a final-price audit |
| v0.21 | `dpl_5ZfyfFUKqLAxtk9qnZwk1JEqct8g` | preview | 9:27 PM | Art no longer covers the window (placeFittedOnWall), mirror moved, systematic collision tests (11 × 3), portrait stain-chip spacing |
| **v0.22** | **`dpl_FETs9VMWPYdwAM8HN1uHyWzgRR8c`** | **preview (latest)** | 9:47 PM | Bathroom/laundry/entry framed as dollhouse in both orientations, procedural vanity + sink under the mirror at realistic height, clean mantel, tub removed, laundry plant fixed |

The v0.17–v0.22 rows follow the deploy order of the preview sessions.

---

## 10. Acceptance checklist for any next change
- [ ] Worked only in `vipro-floor-3d` and didn't touch `vipro-flooring-estimator`, `vipro-preview` or `deck.rhinolab.app`.
- [ ] `npm test` passes: all 50 existing tests plus any new ones.
- [ ] `npx tsc --noEmit` is clean, and `npm run build` produces `out/` without errors.
- [ ] No invented prices. New or changed rates have a real source and are `approved:false` until Vlad approves. Unknowns show "Needs assessment", never $0 or NaN.
- [ ] The minimum is applied once, never per room. Waste applies only to material quantity. Packages are never added together.
- [ ] Tax is applied only when confirmed (address-level result 0/2/3/4, or a confirmed admin override). ZIP-only is not applied.
- [ ] "Preliminary estimate, subject to measurement and inspection" is still visible.
- [ ] Screenshots of all 11 rooms in portrait 390×844 @2x and landscape 1280×800, at visibility 50% and 100%, plus gloss on and evening. Every image was checked by eye: all wall tops visible, no clipping through walls, nothing over windows or doors, no floating objects.
- [ ] Planks and tiles keep their real size. The lay-in animation runs only on a material/pattern change. Swatch clicks recolor immediately.
- [ ] Furniture placement changes live in `lib/room-layout.ts` and the collision tests cover them.
- [ ] Shader changes bump `customProgramCacheKey`.
- [ ] Deployed as a **preview only** (no `target`). The production alias still points at the approved deployment (currently `dpl_E4k2t2wVNEqGWjnKUiMo6Fcd2nJH`).
- [ ] No secrets in code, commits, logs, screenshots or reports.
- [ ] `package.json` version bumped, with a changelog row added to §9 of this file.
- [ ] The report to the owner includes the preview URL, the deployment id, screenshot paths, and an honest list of remaining weak points.
