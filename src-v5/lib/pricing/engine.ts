import type {
  EstimateResult,
  FlagItem,
  LineItem,
  PricingInput,
  RateCard,
  RateRange,
  TaxResult,
} from "./types";

const money = (n: number) => Math.round(n * 100) / 100;

function addFlag(flags: FlagItem[], id: string, severity: FlagItem["severity"], message: string) {
  if (!flags.some((f) => f.id === id)) flags.push({ id, severity, message });
}

function rateDisplay(rate: RateRange): string {
  if (rate.requiresAssessment || (rate.low == null && rate.high == null)) return "requires assessment";
  const low = rate.low == null ? "—" : `$${rate.low}`;
  const high = rate.high == null ? "requires assessment" : rate.highIsOpen ? `$${rate.high}+` : `$${rate.high}`;
  return `${low}–${high} ${unitSuffix(rate)}`.trim();
}

function unitSuffix(rate: RateRange): string {
  if (rate.units === "usd_per_sqft") return "per sq ft";
  if (rate.units === "usd_per_lf") return "per linear ft";
  if (rate.units === "usd_per_item") return "per item";
  return "";
}

function extendRange(rate: RateRange, qty: number): { low: number | null; high: number | null } {
  const low = rate.low == null ? null : money(rate.low * qty);
  const high = rate.high == null ? null : money(rate.high * qty);
  return { low, high };
}

function lineFromRate(
  rate: RateRange,
  qty: number,
  quantityUnit: string,
  kind: LineItem["kind"],
  extraNote?: string,
): LineItem {
  const ext = extendRange(rate, qty);
  return {
    id: rate.id,
    label: rate.label,
    scope: rate.scope,
    quantity: qty,
    quantityUnit,
    unitLow: rate.low,
    unitHigh: rate.high,
    unitLabel: rateDisplay(rate),
    low: ext.low,
    high: ext.high,
    inclusions: rate.inclusions,
    note: [rate.notes, extraNote, rate.highIsOpen ? "The published high is open-ended (listed as $N+)." : ""]
      .filter(Boolean)
      .join(" "),
    kind,
  };
}

export function netWorkArea(input: PricingInput): { floor: number; wall: number; missingRoom: boolean } {
  let floor = 0;
  let wall = 0;
  let missingRoom = input.rooms.length === 0;
  for (const room of input.rooms) {
    if (room.floorSqft == null || !Number.isFinite(room.floorSqft) || room.floorSqft <= 0) missingRoom = true;
    else floor += room.floorSqft;
    if (room.wallOrShowerSqft != null && room.wallOrShowerSqft > 0) wall += room.wallOrShowerSqft;
  }
  return { floor: money(floor), wall: money(wall), missingRoom };
}

export function wasteBand(card: RateCard, pattern: PricingInput["layoutPattern"]): { low: number; high: number } {
  if (pattern === "diagonal" || pattern === "herringbone") return card.waste.diagonalHerringbone;
  return card.waste.straight;
}

export function materialOrderQty(netArea: number, wasteLow: number, wasteHigh: number, carton: number | null) {
  const rawLow = netArea * (1 + wasteLow);
  const rawHigh = netArea * (1 + wasteHigh);
  const round = (raw: number) => {
    if (carton != null && carton > 0) return Math.ceil(raw / carton) * carton;
    return money(raw);
  };
  return { low: round(rawLow), high: round(rawHigh), rawLow: money(rawLow), rawHigh: money(rawHigh) };
}

function refinishRate(card: RateCard, pkg: PricingInput["refinishPackage"]): RateRange | null {
  if (!pkg) return null;
  return card.packages[pkg] ?? null;
}

function installedPackageRate(card: RateCard, material: PricingInput["installMaterial"]): RateRange | "assessment" | "missing" {
  if (material === "unknown") return "missing";
  if (material === "engineered") return card.packages.engineered_installed;
  if (material === "solid") return card.packages.solid_installed_site_finished;
  if (material === "tile") return card.packages.ceramic_porcelain_floor_tile_installed;
  if (material === "parquet") {
    const custom = card.extras.parquet;
    if (custom.low != null || custom.high != null) return custom;
    return "assessment";
  }
  return "missing";
}

function sumKnown(lines: LineItem[], side: "low" | "high"): { value: number | null; incomplete: boolean } {
  let value = 0;
  let saw = false;
  let incomplete = false;
  for (const line of lines) {
    const n = line[side];
    if (n == null) {
      incomplete = true;
      continue;
    }
    value += n;
    saw = true;
  }
  if (!saw && incomplete) return { value: null, incomplete: true };
  if (!saw) return { value: null, incomplete: false };
  return { value: money(value), incomplete };
}

const DEFAULT_TAX_UNCONFIRMED: TaxResult = {
  confirmed: false,
  rate: null,
  source: "Washington Department of Revenue destination lookup",
  note: "Sales tax is unconfirmed. WA rates are destination-specific; a ZIP alone is not enough to confirm a rate.",
};

export function computeEstimate(card: RateCard, input: PricingInput, tax: TaxResult = DEFAULT_TAX_UNCONFIRMED): EstimateResult {
  const flags: FlagItem[] = [];
  const lines: LineItem[] = [];
  const assumptions: string[] = [
    "Preliminary estimate, subject to measurement and inspection.",
  ];
  const exclusions: string[] = [
    "Items marked “requires assessment” are not priced as $0.",
    "On-site conditions, measurement, and inspection can change the outcome.",
  ];
  const formulas: string[] = [];

  const { floor, wall, missingRoom } = netWorkArea(input);
  if (missingRoom || floor <= 0) {
    addFlag(flags, "missing-area", "missing", "Measured floor area is missing or incomplete. Enter each room’s floor area (from length × width or a manual measurement).");
  }
  if (wall > 0) {
    addFlag(
      flags,
      "wall-area-separate",
      "info",
      `Shower or wall area of ${wall} sq ft is recorded separately and is not included in floor work area (${floor} sq ft). Floor package rates are not applied to wall or shower area.`,
    );
    assumptions.push("Floor area and shower/wall area are calculated separately.");
  }

  const waste = wasteBand(card, input.layoutPattern);
  const order = floor > 0 ? materialOrderQty(floor, waste.low, waste.high, input.cartonCoverageSqft) : null;
  formulas.push(`Net work area = sum of measured room floor areas = ${floor} sq ft`);
  formulas.push(`Labor / installed-package quantity uses net work area, not waste-adjusted material quantity.`);
  if (order) {
    formulas.push(
      `Material order quantity = net area × (1 + waste%). Waste ${money(waste.low * 100)}–${money(waste.high * 100)}% for ${input.layoutPattern === "herringbone" || input.layoutPattern === "diagonal" ? "diagonal/herringbone" : "straight"} layout` +
        (input.cartonCoverageSqft ? `, rounded up to cartons of ${input.cartonCoverageSqft} sq ft` : ", no carton coverage provided") +
        ` → ${order.low}–${order.high} sq ft.`,
    );
  }

  if (input.job === "refinish") {
    if (input.family !== "hardwood") {
      addFlag(flags, "refinish-not-hardwood", "missing", "Refinish is offered for existing hardwood. Tile refinish is not in this estimator.");
    }
    if (!input.refinishPackage) {
      addFlag(flags, "missing-refinish-package", "missing", "Choose one refinish package: screen and recoat, full sanding with natural/clear finish, or full sanding with stain. These are alternatives — they are not added together.");
    } else {
      const rate = refinishRate(card, input.refinishPackage);
      if (!rate) addFlag(flags, "missing-refinish-rate", "missing", "The selected refinish package has no configured rate.");
      else if (rate.low == null && rate.high == null) {
        addFlag(flags, "refinish-assessment", "assessment", `${rate.label} requires assessment. It is not shown as $0.`);
      } else if (floor > 0) {
        lines.push(lineFromRate(rate, floor, "sq ft", "package"));
        formulas.push(
          `${rate.label}: ${floor} sq ft × $${rate.low}–$${rate.high} = $${money((rate.low ?? 0) * floor)}–$${money((rate.high ?? 0) * floor)}`,
        );
        assumptions.push(`${rate.label} is a single package. Sanding and finish included in that package are not added again.`);
        exclusions.push(...(rate.exclusions ?? []));
      }
    }
  } else if (input.calcMode === "installed_package") {
    const pkg = installedPackageRate(card, input.installMaterial);
    if (pkg === "missing") {
      addFlag(flags, "missing-material", "missing", "Choose the new flooring type: engineered hardwood, solid hardwood, parquet, or tile. The engine does not guess.");
    } else if (pkg === "assessment") {
      addFlag(flags, "parquet-assessment", "assessment", "Parquet does not have a configured installed rate and requires assessment. It is not shown as $0.");
    } else if (floor > 0) {
      lines.push(lineFromRate(pkg, floor, "sq ft", "package"));
      formulas.push(
        `Installed package (${pkg.label}): ${floor} sq ft × $${pkg.low}–$${pkg.high} = $${money((pkg.low ?? 0) * floor)}–$${money((pkg.high ?? 0) * floor)}. Separate installation labor is not added.`,
      );
      assumptions.push("Calculation mode A (installed package): area × configured all-in price, plus only extras that are explicitly excluded from that package and selected.");
      exclusions.push(...(pkg.exclusions ?? []));
      exclusions.push("Installation labor is included in the installed package and is not itemized again.");
    }
    if (input.siteFinishSeparate && input.installMaterial === "solid") {
      addFlag(
        flags,
        "site-finish-already-in-package",
        "info",
        "The selected solid-hardwood installed package already includes on-site sanding and finishing. A second site-finish line was not added.",
      );
    }
    if (input.productPricePerSqft != null) {
      addFlag(
        flags,
        "material-price-ignored-in-package",
        "info",
        "A product price was entered, but calculation mode A uses the installed package rate. The separate product price is not added (that would double-count material).",
      );
    }
  } else {
    assumptions.push("Calculation mode B (itemized): material + installation labor + separately selected preparation and extras. No installed-package rate is used.");
    if (input.installMaterial === "unknown") {
      addFlag(flags, "missing-material", "missing", "Choose the new flooring type before an itemized labor rate can be selected.");
    }
    if (input.installMaterial === "parquet") {
      addFlag(flags, "parquet-assessment", "assessment", "Parquet requires assessment. No itemized parquet labor rate was invented.");
    }
    if (input.installMaterial === "tile") {
      const labor = card.packages.prefinished_labor_only;
      void labor;
      addFlag(
        flags,
        "tile-labor-not-published",
        "assessment",
        "No separate tile installation-labor rate was published (only the installed tile package). Itemized tile labor requires assessment and is not shown as $0.",
      );
    }
    if (input.installMaterial === "engineered" || input.installMaterial === "solid") {
      const labor = card.packages.prefinished_labor_only;
      if (floor > 0 && (labor.low != null || labor.high != null)) {
        lines.push(lineFromRate(labor, floor, "sq ft", "labor", "Itemized labor only; excludes flooring and preparation."));
        formulas.push(
          `Prefinished installation labor: ${floor} sq ft × $${labor.low}–$${labor.high}${labor.highIsOpen ? "+" : ""} = $${money((labor.low ?? 0) * floor)}–$${money((labor.high ?? 0) * floor)}${labor.highIsOpen ? " (high is open-ended)" : ""}`,
        );
      }
      if (input.installMaterial === "solid" && input.siteFinishSeparate) {
        const finish = card.packages.full_sand_natural;
        addFlag(
          flags,
          "site-finish-separate",
          "info",
          "Unfinished new hardwood: installation and on-site sanding/finishing are separate unless a package includes both. No separate site-finish rate (apart from refinish packages) was published; it is flagged rather than invented. The refinish package rates are not auto-added.",
        );
        exclusions.push("On-site sanding and finishing for new unfinished hardwood is not auto-added to itemized labor.");
        void finish;
      }
    }
    if (input.productPricePerSqft == null) {
      addFlag(flags, "missing-product-price", "missing", "Itemized material price per sq ft was not entered. Material is not shown as $0.");
    } else if (order && input.productPricePerSqft != null) {
      const unit = input.productPricePerSqft;
      const low = money(unit * order.low);
      const high = money(unit * order.high);
      lines.push({
        id: "material",
        label: "Flooring material (customer-entered product price)",
        scope: "Material order quantity = net area × (1 + waste%), rounded up to cartons when coverage is known.",
        quantity: order.low,
        quantityUnit: "sq ft (order qty low–high)",
        unitLow: unit,
        unitHigh: unit,
        unitLabel: `$${unit} per sq ft`,
        low,
        high,
        inclusions: [],
        note: `Uses waste-adjusted quantity ${order.low}–${order.high} sq ft, not net labor area.`,
        kind: "material",
      });
      formulas.push(`Material: product price $${unit}/sq ft × order qty ${order.low}–${order.high} = $${low}–$${high}`);
    }
  }

  // Preparation and extras — only when selected. Use actual areas. Never $0 for unknown.
  if (input.removal.kind !== "none") {
    const rate = input.removal.kind === "tile" ? card.extras.tile_demolition : card.extras.general_flooring_removal;
    if (input.removal.areaSqft == null || input.removal.areaSqft <= 0) {
      addFlag(flags, "missing-removal-area", "missing", "Removal was requested but the removed area was not given. Removal is not assumed to be the whole floor and is not shown as $0.");
    } else if (rate.low == null && rate.high == null) {
      addFlag(flags, "removal-assessment", "assessment", `${rate.label} requires assessment.`);
    } else {
      const li = lineFromRate(rate, input.removal.areaSqft, "sq ft", "prep");
      lines.push(li);
      formulas.push(
        `${rate.label}: ${input.removal.areaSqft} sq ft of removed area × ${rateDisplay(rate)}` +
          (li.low != null ? ` → $${li.low}` : "") +
          (li.high != null ? `–$${li.high}` : li.low != null ? " (high requires inspection)" : ""),
      );
      if (rate.high == null) addFlag(flags, "tile-demo-high", "assessment", "Tile demolition is published from $3.50 per sq ft; the high side requires inspection for difficult assemblies.");
    }
  }

  if (input.subfloorRepair.selected) {
    const rate = card.extras.subfloor_repair_leveling;
    if (input.subfloorRepair.areaSqft == null || input.subfloorRepair.areaSqft <= 0) {
      addFlag(flags, "missing-subfloor-area", "missing", "Subfloor repair or leveling was requested but the affected area was not given. The whole floor is not charged automatically.");
    } else {
      const li = lineFromRate(rate, input.subfloorRepair.areaSqft, "sq ft", "prep");
      lines.push(li);
      formulas.push(`Subfloor repair/leveling: ${input.subfloorRepair.areaSqft} sq ft affected × $${rate.low}–$${rate.high} = $${li.low}–$${li.high}`);
    }
  }

  const assessExtra = (selected: boolean, key: keyof RateCard["extras"], reason: string, qty: number | null, qtyUnit: string) => {
    if (!selected) return;
    const rate = card.extras[key];
    if (!rate) return;
    if (rate.low == null && rate.high == null) {
      addFlag(flags, `assess-${key}`, "assessment", `${rate.label}: ${reason} It is not shown as $0.`);
      return;
    }
    if (qty == null || qty <= 0) {
      addFlag(flags, `missing-qty-${key}`, "missing", `${rate.label} was requested but the quantity is missing.`);
      return;
    }
    lines.push(lineFromRate(rate, qty, qtyUnit, "extra"));
  };

  assessExtra(input.stairs.selected, "stairs", "No stair price was provided.", input.stairs.count, "item");
  assessExtra(input.trimLf != null && input.trimLf > 0, "trim", "No trim rate was provided.", input.trimLf, "linear ft");
  assessExtra(input.transitionsCount != null && input.transitionsCount > 0, "transitions", "No transition rate was provided.", input.transitionsCount, "item");
  assessExtra(input.furnitureMoving === "yes", "furniture_moving", "No furniture-moving price was provided.", 1, "job");
  if (input.furnitureMoving === "unknown") addFlag(flags, "furniture-unknown", "missing", "Furniture moving was marked unknown. It is not priced as $0.");

  if (input.flags.showerWaterproofing || wall > 0) {
    assessExtra(true, "shower_waterproofing", "No shower waterproofing price was provided.", wall > 0 ? wall : null, "sq ft");
    if (wall <= 0 && input.flags.showerWaterproofing) {
      addFlag(flags, "missing-shower-area", "missing", "Shower waterproofing was requested but no shower or wall area was entered.");
    }
  }
  if (input.flags.premiumMaterials) assessExtra(true, "premium_materials", "No premium-material surcharge was provided.", null, "sq ft");
  if (input.flags.unusualConditions) assessExtra(true, "unusual_conditions", "Unusual conditions require inspection.", null, "sq ft");
  if (input.layoutPattern === "herringbone" || input.flags.intricatePattern) {
    assessExtra(true, "herringbone", "Herringbone and intricate patterns have no configured surcharge.", null, "sq ft");
  }

  if (input.flags.engineeredWearLayerUnknown) addFlag(flags, "wear-layer", "assessment", "Engineered floor with unknown wear-layer thickness — inspection required before refinishing or sanding.");
  if (input.flags.deepStains) addFlag(flags, "deep-stains", "assessment", "Deep stains — inspection required.");
  if (input.flags.moisture) addFlag(flags, "moisture", "assessment", "Moisture concerns — inspection required.");
  if (input.flags.contamination) addFlag(flags, "contamination", "assessment", "Contamination — inspection required.");
  if (input.flags.structuralDamage) addFlag(flags, "structural", "assessment", "Structural damage — inspection required.");
  if (input.flags.uncertainRepairs) addFlag(flags, "repairs-uncertain", "assessment", "Uncertain repairs — inspection required.");

  if (card.contingency.enabled) {
    if (card.contingency.percentLow == null && card.contingency.percentHigh == null) {
      addFlag(flags, "contingency-unset", "missing", "Contingency is enabled but no percent was configured. It is not treated as 0%.");
    }
  }

  const preMin = sumKnown(lines, "low");
  const preMinH = sumKnown(lines, "high");
  const minCfg = card.minimums.smallJob;
  const minAmount = minCfg.low;
  const shouldApplyPlaceholder = Boolean(input.applyUnapprovedMinimumPlaceholder && minCfg.placeholder && minAmount != null);
  const shouldApplyApproved = Boolean(!minCfg.placeholder && minCfg.approved && minAmount != null);
  const applyMin = shouldApplyPlaceholder || shouldApplyApproved;

  let adjustmentLow: number | null = null;
  let adjustmentHigh: number | null = null;
  let illustrativeLow: number | null = null;
  let illustrativeHigh: number | null = null;
  let applied = false;

  const formulaMin = `Small-job minimum is applied once to the selected package scope: adjustedLow = max(subtotalLow, minimum), adjustedHigh = max(subtotalHigh, minimum). It is not applied per room. Configured amount = ${minAmount == null ? "not set" : "$" + minAmount} (${minCfg.placeholder ? "UNAPPROVED PLACEHOLDER" : minCfg.approved ? "approved" : "unapproved"}).`;
  formulas.push(formulaMin);

  if (minAmount != null && preMin.value != null && preMinH.value != null) {
    illustrativeLow = money(Math.max(preMin.value, minAmount));
    illustrativeHigh = money(Math.max(preMinH.value, minAmount));
  }

  if (applyMin && minAmount != null && preMin.value != null && preMinH.value != null) {
    adjustmentLow = money(Math.max(0, minAmount - preMin.value));
    adjustmentHigh = money(Math.max(0, minAmount - preMinH.value));
    if (adjustmentLow > 0 || adjustmentHigh > 0) {
      lines.push({
        id: "small_job_minimum",
        label: minCfg.label,
        scope: minCfg.scope,
        quantity: 1,
        quantityUnit: "job",
        unitLow: minAmount,
        unitHigh: minAmount,
        unitLabel: `$${minAmount} once`,
        low: adjustmentLow,
        high: adjustmentHigh,
        inclusions: [],
        note: minCfg.notes,
        kind: "minimum",
      });
      applied = true;
      formulas.push(
        `Minimum application: max(${preMin.value}, ${minAmount}) = ${illustrativeLow}; max(${preMinH.value}, ${minAmount}) = ${illustrativeHigh}. Adjustment +$${adjustmentLow} / +$${adjustmentHigh}.`,
      );
    } else {
      formulas.push(`Minimum does not lift the total because both sides already meet $${minAmount}.`);
    }
  } else if (minCfg.placeholder && minAmount != null) {
    addFlag(
      flags,
      "minimum-unapproved",
      "info",
      `A small-job minimum may apply. The amount has not been approved. Admin holds an unapproved placeholder of $${minAmount}. If applied once: low = max(${preMin.value ?? "—"}, ${minAmount}) = ${illustrativeLow ?? "—"}, high = max(${preMinH.value ?? "—"}, ${minAmount}) = ${illustrativeHigh ?? "—"}. The main customer subtotal does not silently treat the unknown minimum as $0 or as an approved VIPRO price.`,
    );
  } else if (minAmount == null) {
    addFlag(flags, "minimum-unset", "missing", "No small-job minimum is configured. An unknown minimum is not shown as $0.");
  }

  const subL = sumKnown(lines, "low");
  const subH = sumKnown(lines, "high");

  let resolvedTax = tax;
  if (card.tax.overrideConfirmed && card.tax.overrideRate != null) {
    resolvedTax = {
      confirmed: true,
      rate: card.tax.overrideRate,
      source: "Admin-confirmed destination rate",
      note: "Using the destination-specific rate entered in admin after a WA DOR lookup.",
    };
  }

  let taxLow: number | null = null;
  let taxHigh: number | null = null;
  let totalLow = subL.value;
  let totalHigh = subH.value;
  if (resolvedTax.confirmed && resolvedTax.rate != null && subL.value != null && subH.value != null) {
    taxLow = money(subL.value * resolvedTax.rate);
    taxHigh = money(subH.value * resolvedTax.rate);
    totalLow = money(subL.value + taxLow);
    totalHigh = money(subH.value + taxHigh);
    formulas.push(`WA destination tax at ${(resolvedTax.rate * 100).toFixed(2)}% of taxable subtotal (including labor if residential construction is taxable): tax $${taxLow}–$${taxHigh}; estimated total $${totalLow}–$${totalHigh}.`);
  } else {
    if (!resolvedTax.note) resolvedTax = { ...resolvedTax, ...DEFAULT_TAX_UNCONFIRMED };
    addFlag(flags, "tax-unconfirmed", "info", resolvedTax.note || DEFAULT_TAX_UNCONFIRMED.note);
    formulas.push("Estimated total after tax is unconfirmed because no destination-specific WA DOR rate was confirmed.");
  }

  if (subL.incomplete || subH.incomplete) {
    addFlag(flags, "incomplete-high-or-low", "assessment", "At least one priced line has no published low or high. The matching total side is incomplete and is not filled in with $0.");
  }

  return {
    preliminary: true,
    headline: "Preliminary estimate, subject to measurement and inspection",
    netWorkAreaSqft: floor,
    wallOrShowerSqft: wall,
    materialOrderQtyLow: order?.low ?? null,
    materialOrderQtyHigh: order?.high ?? null,
    wastePercentLow: waste.low,
    wastePercentHigh: waste.high,
    lines,
    flags,
    assumptions,
    exclusions: Array.from(new Set(exclusions.filter(Boolean))),
    subtotalLow: subL.value != null && Number.isFinite(subL.value) ? subL.value : null,
    subtotalHigh: subH.value != null && Number.isFinite(subH.value) ? subH.value : null,
    incompleteLow: subL.incomplete || (subL.value != null && !Number.isFinite(subL.value)),
    incompleteHigh: subH.incomplete || (subH.value != null && !Number.isFinite(subH.value)),
    minimum: {
      configuredAmount: minAmount,
      approved: Boolean(minCfg.approved),
      placeholder: Boolean(minCfg.placeholder),
      applied,
      formula: formulaMin,
      adjustmentLow,
      adjustmentHigh,
      illustrativeLow,
      illustrativeHigh,
    },
    tax: resolvedTax,
    taxLow,
    taxHigh,
    totalLow,
    totalHigh,
    formulas,
  };
}

export { DEFAULT_TAX_UNCONFIRMED };
