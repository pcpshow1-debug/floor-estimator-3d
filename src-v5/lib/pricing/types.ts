export type MoneyUnits = "usd_per_sqft" | "usd_per_lf" | "usd_per_item" | "usd_fixed";

export type RateRange = {
  id: string;
  label: string;
  low: number | null;
  high: number | null;
  highIsOpen?: boolean;
  units: MoneyUnits;
  scope: string;
  inclusions: string[];
  exclusions?: string[];
  source: string;
  sourceUrl: string | null;
  asOf: string;
  approved: boolean;
  notes?: string;
  requiresAssessment?: boolean;
  placeholder?: boolean;
};

export type WasteBand = { low: number; high: number; notes: string };

export type RateCard = {
  version: number;
  serviceArea: string;
  disclaimer: string;
  approvedByVlad: boolean;
  defaultSource: string;
  asOf: string;
  packages: Record<string, RateRange>;
  extras: Record<string, RateRange>;
  waste: {
    straight: WasteBand;
    diagonalHerringbone: WasteBand;
  };
  minimums: {
    smallJob: RateRange & {
      applyOnceTo: string;
      applyPerRoom: false;
    };
  };
  contingency: {
    enabled: boolean;
    percentLow: number | null;
    percentHigh: number | null;
    approved: boolean;
    notes: string;
  };
  tax: {
    provider: string;
    docsUrl: string;
    lookupUrl: string;
    note: string;
    overrideRate: number | null;
    overrideConfirmed: boolean;
  };
};

export type RoomInput = {
  id: string;
  name: string;
  floorSqft: number | null;
  wallOrShowerSqft: number | null;
  lengthFt?: number | null;
  widthFt?: number | null;
  areaSource: "lxw" | "manual";
};

export type RemovalKind = "none" | "general" | "tile";

export type PricingInput = {
  job: "refinish" | "new";
  family: "hardwood" | "tile";
  refinishPackage: "screen_recoat" | "full_sand_natural" | "full_sand_stained" | null;
  installMaterial: "engineered" | "solid" | "parquet" | "tile" | "unknown";
  calcMode: "installed_package" | "itemized";
  siteFinishSeparate: boolean;
  rooms: RoomInput[];
  layoutPattern: "straight" | "diagonal" | "herringbone" | "other";
  removal: { kind: RemovalKind; areaSqft: number | null };
  subfloorRepair: { selected: boolean; areaSqft: number | null };
  stairs: { selected: boolean; count: number | null };
  trimLf: number | null;
  transitionsCount: number | null;
  furnitureMoving: "no" | "yes" | "unknown";
  productPricePerSqft: number | null;
  cartonCoverageSqft: number | null;
  flags: {
    engineeredWearLayerUnknown?: boolean;
    deepStains?: boolean;
    moisture?: boolean;
    contamination?: boolean;
    structuralDamage?: boolean;
    uncertainRepairs?: boolean;
    showerWaterproofing?: boolean;
    premiumMaterials?: boolean;
    intricatePattern?: boolean;
    unusualConditions?: boolean;
  };
  zip?: string;
  streetAddress?: string;
  city?: string;
  applyUnapprovedMinimumPlaceholder?: boolean;
};

export type LineItem = {
  id: string;
  label: string;
  scope: string;
  quantity: number;
  quantityUnit: string;
  unitLow: number | null;
  unitHigh: number | null;
  unitLabel: string;
  low: number | null;
  high: number | null;
  inclusions: string[];
  note?: string;
  kind: "package" | "labor" | "material" | "prep" | "extra" | "minimum" | "contingency";
};

export type FlagItem = {
  id: string;
  severity: "missing" | "assessment" | "info";
  message: string;
};

export type TaxResult = {
  confirmed: boolean;
  rate: number | null;
  locationCode?: string | null;
  resultCode?: number | null;
  period?: string | null;
  jurisdiction?: string | null;
  source: string;
  note: string;
};

export type EstimateResult = {
  preliminary: true;
  headline: string;
  netWorkAreaSqft: number;
  wallOrShowerSqft: number;
  materialOrderQtyLow: number | null;
  materialOrderQtyHigh: number | null;
  wastePercentLow: number | null;
  wastePercentHigh: number | null;
  lines: LineItem[];
  flags: FlagItem[];
  assumptions: string[];
  exclusions: string[];
  subtotalLow: number | null;
  subtotalHigh: number | null;
  incompleteLow: boolean;
  incompleteHigh: boolean;
  minimum: {
    configuredAmount: number | null;
    approved: boolean;
    placeholder: boolean;
    applied: boolean;
    formula: string;
    adjustmentLow: number | null;
    adjustmentHigh: number | null;
    illustrativeLow: number | null;
    illustrativeHigh: number | null;
  };
  tax: TaxResult;
  taxLow: number | null;
  taxHigh: number | null;
  totalLow: number | null;
  totalHigh: number | null;
  formulas: string[];
};
