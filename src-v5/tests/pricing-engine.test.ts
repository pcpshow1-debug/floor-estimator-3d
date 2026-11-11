import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultRateCard } from "../config/default-rate-card";
import { computeEstimate, materialOrderQty } from "../lib/pricing/engine";
import type { PricingInput } from "../lib/pricing/types";

function room(sqft: number, id = "r1"): PricingInput["rooms"][number] {
  return { id, name: "Room 1", floorSqft: sqft, wallOrShowerSqft: null, areaSource: "manual" };
}

function base(partial: Partial<PricingInput>): PricingInput {
  return {
    job: "refinish",
    family: "hardwood",
    refinishPackage: "full_sand_natural",
    installMaterial: "unknown",
    calcMode: "installed_package",
    siteFinishSeparate: false,
    rooms: [room(500)],
    layoutPattern: "straight",
    removal: { kind: "none", areaSqft: null },
    subfloorRepair: { selected: false, areaSqft: null },
    stairs: { selected: false, count: null },
    trimLf: null,
    transitionsCount: null,
    furnitureMoving: "no",
    productPricePerSqft: null,
    cartonCoverageSqft: null,
    flags: {},
    applyUnapprovedMinimumPlaceholder: false,
    ...partial,
  };
}

describe("VIPRO pricing engine", () => {
  it("500 sq ft natural refinish: 500 × $4–$7 = $2,000–$3,500, no double-counted sanding or finish", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "refinish",
      refinishPackage: "full_sand_natural",
      rooms: [room(500)],
    }));
    const expectedLow = 500 * 4;
    const expectedHigh = 500 * 7;
    assert.equal(estimate.netWorkAreaSqft, 500);
    assert.equal(estimate.subtotalLow, expectedLow);
    assert.equal(estimate.subtotalHigh, expectedHigh);
    assert.equal(estimate.lines.length, 1);
    assert.equal(estimate.lines[0].id, "full_sand_natural");
    assert.ok(!estimate.lines.some((l) => l.id === "screen_recoat" || l.id === "full_sand_stained"));
    assert.ok(!estimate.lines.some((l) => l.id === "prefinished_labor_only"));
    assert.equal(estimate.lines.filter((l) => /sand/i.test(l.label)).length, 1);
    assert.match(estimate.formulas.join("\n"), /500 sq ft × \$4–\$7 = \$2000–\$3500/);
    assert.equal(estimate.tax.confirmed, false);
    assert.equal(estimate.taxLow, null);
    console.log("SCENARIO 1 natural refinish 500 sf");
    console.log("  formula: 500 × $4–$7 (full sanding and natural/clear refinish package)");
    console.log(`  low=${estimate.subtotalLow} high=${estimate.subtotalHigh}`);
    console.log("  tax: unconfirmed (no destination address)");
  });

  it("500 sq ft stained refinish: 500 × $5–$8 = $2,500–$4,000 and does not add the natural package", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "refinish",
      refinishPackage: "full_sand_stained",
      rooms: [room(500)],
    }));
    assert.equal(estimate.subtotalLow, 500 * 5);
    assert.equal(estimate.subtotalHigh, 500 * 8);
    assert.equal(estimate.lines.length, 1);
    assert.equal(estimate.lines[0].id, "full_sand_stained");
    assert.ok(!estimate.lines.some((l) => l.id === "full_sand_natural" || l.id === "screen_recoat"));
    assert.match(estimate.formulas.join("\n"), /500 sq ft × \$5–\$8 = \$2500–\$4000/);
    console.log("SCENARIO 2 stained refinish 500 sf");
    console.log("  formula: 500 × $5–$8 (full sanding and stained refinish package)");
    console.log(`  low=${estimate.subtotalLow} high=${estimate.subtotalHigh}`);
  });

  it("1,000 sq ft engineered installed package: 1000 × $9–$16 = $9,000–$16,000 without extra labor or waste on the package", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "hardwood",
      refinishPackage: null,
      installMaterial: "engineered",
      calcMode: "installed_package",
      rooms: [room(1000)],
      productPricePerSqft: 4.5,
    }));
    assert.equal(estimate.subtotalLow, 1000 * 9);
    assert.equal(estimate.subtotalHigh, 1000 * 16);
    assert.ok(estimate.lines.some((l) => l.id === "engineered_installed"));
    assert.ok(!estimate.lines.some((l) => l.id === "prefinished_labor_only"), "must not add itemized labor onto an installed package");
    assert.ok(!estimate.lines.some((l) => l.id === "material"), "must not add a separate material line onto an installed package");
    assert.ok(!estimate.lines.some((l) => l.kind === "minimum" && l.applied));
    const waste = materialOrderQty(1000, 0.07, 0.1, null);
    assert.equal(waste.low, 1070);
    assert.equal(waste.high, 1100);
    assert.equal(estimate.materialOrderQtyLow, 1070);
    assert.equal(estimate.materialOrderQtyHigh, 1100);
    assert.notEqual(estimate.subtotalLow, 1070 * 9, "package must use net area, not waste-adjusted qty");
    assert.ok(estimate.flags.some((f) => f.id === "material-price-ignored-in-package"));
    console.log("SCENARIO 3 engineered installed 1000 sf");
    console.log("  formula: 1000 × $9–$16 (installed package, net work area)");
    console.log("  waste for material planning only: 1000 × 1.07–1.10 = 1070–1100 sq ft (not applied to package dollars)");
    console.log(`  low=${estimate.subtotalLow} high=${estimate.subtotalHigh}`);
  });

  it("45 sq ft tile bathroom: package 45 × $14–$28, and placeholder minimum applied once", () => {
    const without = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "tile",
      refinishPackage: null,
      installMaterial: "tile",
      calcMode: "installed_package",
      rooms: [room(45)],
      applyUnapprovedMinimumPlaceholder: false,
    }));
    const packageLow = 45 * 14;
    const packageHigh = 45 * 28;
    assert.equal(without.lines.find((l) => l.id === "ceramic_porcelain_floor_tile_installed")?.low, packageLow);
    assert.equal(without.lines.find((l) => l.id === "ceramic_porcelain_floor_tile_installed")?.high, packageHigh);
    assert.equal(without.subtotalLow, packageLow);
    assert.equal(without.subtotalHigh, packageHigh);
    assert.equal(without.minimum.applied, false);
    assert.equal(without.minimum.placeholder, true);
    assert.equal(without.minimum.configuredAmount, 1800);
    assert.equal(without.minimum.illustrativeLow, 1800);
    assert.equal(without.minimum.illustrativeHigh, 1800);
    assert.ok(without.flags.some((f) => f.id === "minimum-unapproved"));

    const withMin = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "tile",
      refinishPackage: null,
      installMaterial: "tile",
      calcMode: "installed_package",
      rooms: [room(45)],
      applyUnapprovedMinimumPlaceholder: true,
    }));
    assert.equal(withMin.minimum.applied, true);
    assert.equal(withMin.minimum.adjustmentLow, 1800 - packageLow);
    assert.equal(withMin.minimum.adjustmentHigh, 1800 - packageHigh);
    assert.equal(withMin.subtotalLow, 1800);
    assert.equal(withMin.subtotalHigh, 1800);

    const twoRooms = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "tile",
      refinishPackage: null,
      installMaterial: "tile",
      calcMode: "installed_package",
      rooms: [room(20, "a"), room(25, "b")],
      applyUnapprovedMinimumPlaceholder: true,
    }));
    assert.equal(twoRooms.netWorkAreaSqft, 45);
    assert.equal(twoRooms.lines.filter((l) => l.kind === "minimum").length, 1, "minimum applies once, not per room");
    assert.equal(twoRooms.subtotalLow, 1800);

    console.log("SCENARIO 4 tile bathroom 45 sf");
    console.log(`  package formula: 45 × $14–$28 = $${packageLow}–$${packageHigh}`);
    console.log(`  without placeholder minimum: low=${without.subtotalLow} high=${without.subtotalHigh} (minimum flagged, not treated as $0)`);
    console.log(`  placeholder amount (unapproved): $1800`);
    console.log(`  application: max(${packageLow}, 1800)=1800; max(${packageHigh}, 1800)=1800`);
    console.log(`  adjustment: +$${1800 - packageLow} / +$${1800 - packageHigh}`);
    console.log(`  with placeholder applied: low=${withMin.subtotalLow} high=${withMin.subtotalHigh}`);
    console.log("  two rooms totaling 45 sf still receive one minimum, not two");
  });

  it("does not double-count stairs, waste, or unknown extras as $0", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "hardwood",
      refinishPackage: null,
      installMaterial: "engineered",
      calcMode: "installed_package",
      rooms: [room(1000)],
      layoutPattern: "herringbone",
      stairs: { selected: true, count: 12 },
      flags: { intricatePattern: true, moisture: true },
    }));
    assert.ok(!estimate.lines.some((l) => l.id === "stairs"));
    assert.ok(estimate.flags.some((f) => f.id === "assess-stairs"));
    assert.ok(estimate.flags.some((f) => f.id === "assess-herringbone"));
    assert.ok(estimate.flags.some((f) => f.id === "moisture"));
    assert.ok(!estimate.lines.some((l) => l.low === 0 && l.id === "stairs"));
    assert.equal(estimate.subtotalLow, 9000);
    assert.equal(estimate.subtotalHigh, 16000);
    assert.equal(estimate.materialOrderQtyLow, 1000 * 1.12);
    assert.equal(estimate.materialOrderQtyHigh, 1000 * 1.15);
  });

  it("itemized mode uses labor + material with waste and never the installed package", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "hardwood",
      refinishPackage: null,
      installMaterial: "engineered",
      calcMode: "itemized",
      rooms: [room(1000)],
      productPricePerSqft: 6,
      cartonCoverageSqft: 20,
    }));
    assert.ok(estimate.lines.some((l) => l.id === "prefinished_labor_only"));
    assert.ok(estimate.lines.some((l) => l.id === "material"));
    assert.ok(!estimate.lines.some((l) => l.id === "engineered_installed"));
    const laborLow = 1000 * 3.25;
    const laborHigh = 1000 * 5;
    const order = materialOrderQty(1000, 0.07, 0.1, 20);
    assert.equal(order.low, Math.ceil(1070 / 20) * 20);
    assert.equal(order.high, Math.ceil(1100 / 20) * 20);
    const mat = estimate.lines.find((l) => l.id === "material");
    assert.equal(mat?.low, 6 * order.low);
    assert.equal(mat?.high, 6 * order.high);
    assert.equal(estimate.subtotalLow, laborLow + 6 * order.low);
    assert.equal(estimate.subtotalHigh, laborHigh + 6 * order.high);
  });

  it("flags missing inputs instead of guessing material type or area", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "hardwood",
      refinishPackage: null,
      installMaterial: "unknown",
      calcMode: "installed_package",
      rooms: [{ id: "r1", name: "Room", floorSqft: null, wallOrShowerSqft: null, areaSource: "manual" }],
    }));
    assert.ok(estimate.flags.some((f) => f.id === "missing-area"));
    assert.ok(estimate.flags.some((f) => f.id === "missing-material"));
    assert.equal(estimate.lines.length, 0);
    assert.equal(estimate.subtotalLow, null);
    assert.equal(estimate.subtotalHigh, null);
  });

  it("stairs without a published rate are flagged for assessment and never priced as $0", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "hardwood",
      refinishPackage: null,
      installMaterial: "engineered",
      calcMode: "installed_package",
      rooms: [room(252)],
      stairs: { selected: true, count: 13 },
    }));
    assert.ok(!estimate.lines.some((l) => l.id === "stairs"));
    assert.ok(estimate.flags.some((f) => f.id === "assess-stairs"));
    assert.equal(estimate.subtotalLow, 252 * 9);
    assert.equal(estimate.subtotalHigh, 252 * 16);
    assert.equal(estimate.incompleteLow, false);
    assert.equal(estimate.incompleteHigh, false);
  });

  it("admin-configured stair rate is applied once per tread/item and not invented from defaults", () => {
    const card = structuredClone(defaultRateCard);
    card.extras.stairs = { ...card.extras.stairs, low: 40, high: 75, requiresAssessment: false, notes: "Admin override test" };
    const estimate = computeEstimate(card, base({
      job: "new",
      family: "hardwood",
      refinishPackage: null,
      installMaterial: "engineered",
      calcMode: "installed_package",
      rooms: [room(252)],
      stairs: { selected: true, count: 12 },
    }));
    const stair = estimate.lines.find((l) => l.id === "stairs");
    assert.ok(stair);
    assert.equal(stair?.quantity, 12);
    assert.equal(stair?.low, 12 * 40);
    assert.equal(stair?.high, 12 * 75);
    assert.equal(estimate.subtotalLow, 252 * 9 + 480);
    assert.equal(estimate.subtotalHigh, 252 * 16 + 900);
  });

  it("tile demolition publishes a low and leaves the high side open instead of filling $0", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "tile",
      refinishPackage: null,
      installMaterial: "tile",
      calcMode: "installed_package",
      rooms: [room(200)],
      removal: { kind: "tile", areaSqft: 40 },
    }));
    const demo = estimate.lines.find((l) => l.id === "tile_demolition");
    assert.equal(demo?.low, 40 * 3.5);
    assert.equal(demo?.high, null);
    assert.equal(estimate.incompleteHigh, true);
    assert.equal(estimate.subtotalLow, 200 * 14 + 140);
    assert.ok(estimate.subtotalHigh != null);
    assert.ok(estimate.flags.some((f) => f.id === "tile-demo-high" || f.id === "incomplete-high-or-low"));
  });

  it("parquet and itemized tile labor require assessment instead of a $0 line", () => {
    const parquet = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "hardwood",
      refinishPackage: null,
      installMaterial: "parquet",
      calcMode: "installed_package",
      rooms: [room(300)],
    }));
    assert.equal(parquet.lines.length, 0);
    assert.equal(parquet.subtotalLow, null);
    assert.equal(parquet.subtotalHigh, null);
    assert.ok(parquet.flags.some((f) => f.id === "parquet-assessment"));

    const tileItemized = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "tile",
      refinishPackage: null,
      installMaterial: "tile",
      calcMode: "itemized",
      rooms: [room(80)],
      productPricePerSqft: 5,
    }));
    assert.ok(!tileItemized.lines.some((l) => l.id === "ceramic_porcelain_floor_tile_installed"));
    assert.ok(tileItemized.flags.some((f) => f.id === "tile-labor-not-published"));
    assert.ok(tileItemized.lines.some((l) => l.id === "material"));
  });

  it("confirmed destination tax applies to the subtotal and admin override wins", () => {
    const taxed = computeEstimate(
      defaultRateCard,
      base({ job: "refinish", refinishPackage: "full_sand_natural", rooms: [room(500)] }),
      { confirmed: true, rate: 0.1025, source: "test", note: "test destination" },
    );
    assert.equal(taxed.subtotalLow, 2000);
    assert.equal(taxed.taxLow, 205);
    assert.equal(taxed.totalLow, 2205);

    const card = structuredClone(defaultRateCard);
    card.tax.overrideConfirmed = true;
    card.tax.overrideRate = 0.08;
    const overridden = computeEstimate(
      card,
      base({ job: "refinish", refinishPackage: "full_sand_natural", rooms: [room(500)] }),
      { confirmed: true, rate: 0.1025, source: "ignored", note: "should be replaced" },
    );
    assert.equal(overridden.tax.confirmed, true);
    assert.equal(overridden.tax.rate, 0.08);
    assert.equal(overridden.taxLow, 160);
  });

  it("wall/shower area is not folded into the floor package", () => {
    const estimate = computeEstimate(defaultRateCard, base({
      job: "new",
      family: "tile",
      refinishPackage: null,
      installMaterial: "tile",
      calcMode: "installed_package",
      rooms: [{ id: "bath", name: "Bath", floorSqft: 45, wallOrShowerSqft: 80, areaSource: "manual" }],
    }));
    assert.equal(estimate.netWorkAreaSqft, 45);
    assert.equal(estimate.wallOrShowerSqft, 80);
    assert.equal(estimate.subtotalLow, 45 * 14);
    assert.ok(estimate.flags.some((f) => f.id === "wall-area-separate" || f.id === "assess-shower_waterproofing" || f.id === "missing-qty-shower_waterproofing"));
  });

  it("every default package and refinish combo produces a finite range or a null that means assessment, never NaN or $0", () => {
    const jobs: Array<Parameters<typeof base>[0]> = [
      { job: "refinish", refinishPackage: "screen_recoat", rooms: [room(400)] },
      { job: "refinish", refinishPackage: "full_sand_natural", rooms: [room(400)] },
      { job: "refinish", refinishPackage: "full_sand_stained", rooms: [room(400)] },
      { job: "new", family: "hardwood", refinishPackage: null, installMaterial: "engineered", calcMode: "installed_package", rooms: [room(400)] },
      { job: "new", family: "hardwood", refinishPackage: null, installMaterial: "solid", calcMode: "installed_package", rooms: [room(400)] },
      { job: "new", family: "tile", refinishPackage: null, installMaterial: "tile", calcMode: "installed_package", rooms: [room(400)] },
      { job: "new", family: "hardwood", refinishPackage: null, installMaterial: "parquet", calcMode: "installed_package", rooms: [room(400)] },
      { job: "new", family: "hardwood", refinishPackage: null, installMaterial: "engineered", calcMode: "itemized", rooms: [room(400)], productPricePerSqft: 7 },
    ];
    for (const partial of jobs) {
      const estimate = computeEstimate(defaultRateCard, base(partial));
      for (const side of [estimate.subtotalLow, estimate.subtotalHigh, estimate.totalLow, estimate.totalHigh] as const) {
        if (side != null) {
          assert.equal(Number.isFinite(side), true);
          assert.ok(side > 0, `priced side must be > 0, got ${side} for ${JSON.stringify(partial)}`);
        }
      }
      for (const line of estimate.lines) {
        if (line.low != null) assert.ok(Number.isFinite(line.low) && line.low > 0);
        if (line.high != null) assert.ok(Number.isFinite(line.high) && line.high > 0);
      }
    }
  });
});
