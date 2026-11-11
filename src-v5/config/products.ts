export const approvalNote = "Sealers and stain names are pending Vlad's approval.";

export const species = [
  { id: "white-oak", label: "White oak", base: "white-oak" },
  { id: "red-oak", label: "Red oak", base: "red-oak" },
  { id: "walnut", label: "Walnut", base: "walnut" },
  { id: "maple", label: "Maple", base: "maple" },
] as const;

export const patterns = [
  { id: "straight", label: "Straight" },
  { id: "herringbone", label: "Herringbone" },
  { id: "chevron", label: "Chevron" },
] as const;

export const stains = [
  { id: "country-white", label: "Country White", code: "101", color: "#e6e2d6" },
  { id: "neutral", label: "Neutral", code: "110", color: "#d4c8b0" },
  { id: "silvered-gray", label: "Silvered Gray", code: "181", color: "#b4aea6" },
  { id: "golden-pecan", label: "Golden Pecan", code: "145", color: "#c2a06e" },
  { id: "fruitwood", label: "Fruitwood", code: "141", color: "#b5894e" },
  { id: "golden-oak", label: "Golden Oak", code: "112", color: "#c2a06a" },
  { id: "classic-gray", label: "Classic Gray", code: "172", color: "#9a9086" },
  { id: "early-american", label: "Early American", code: "130", color: "#8a5a32" },
  { id: "special-walnut", label: "Special Walnut", code: "124", color: "#6b4423" },
  { id: "provincial", label: "Provincial", code: "111", color: "#7a4e28" },
  { id: "dark-walnut", label: "Dark Walnut", code: "171", color: "#3a2416" },
  { id: "jacobean", label: "Jacobean", code: "175", color: "#24180f" },
  { id: "ebony", label: "Ebony", code: "131", color: "#0c0b0a" },
  { id: "true-black", label: "True Black", code: "199", color: "#080807" },
] as const;

export const sealers = [
  { id: "nordic-seal", label: "NordicSeal", detail: "Whitewash, no bleach.", color: "#e8e4da" },
  { id: "natural-seal", label: "NaturalSeal", detail: "Keeps the look of freshly sanded wood.", color: "#ddd2bc" },
  { id: "classic-seal", label: "ClassicSeal", detail: "Clear. Shows the wood's own color.", color: "#d2c19a" },
  { id: "intense-seal", label: "IntenseSeal", detail: "Deeper color, a wetter look.", color: "#c4a56c" },
  { id: "amber-seal", label: "AmberSeal", detail: "Warm oil-modified tone.", color: "#c49248" },
] as const;

export const sheens = [
  { id: "matte", label: "Matte" },
  { id: "satin", label: "Satin" },
  { id: "semi", label: "Semi-gloss" },
  { id: "gloss", label: "Gloss" },
] as const;

export const tileStyles = [
  { id: "porcelain-24", label: "24×24 porcelain", detail: "Large-format porcelain, straight lay.", tex: "porcelain", texB: "", pattern: "grid", tw: 0.6096, th: 0.6096 },
  { id: "porcelain-12x24", label: "12×24 porcelain", detail: "Rectangular porcelain, straight lay.", tex: "porcelain", texB: "", pattern: "grid", tw: 0.6096, th: 0.3048 },
  { id: "porcelain-12x24-offset", label: "12×24 offset", detail: "12 × 24 porcelain with a 1/3 offset.", tex: "porcelain", texB: "", pattern: "offset", tw: 0.6096, th: 0.3048, offset: 1 / 3 },
  { id: "wood-look", label: "Wood-look plank", detail: "Porcelain plank tiled in a running bond.", tex: "wood-look", texB: "", pattern: "offset", tw: 1.016, th: 0.1778, offset: 0.35 },
  { id: "carrara", label: "Carrara marble", detail: "Cool grey veins on a white ground.", tex: "carrara", texB: "", pattern: "grid", tw: 0.6096, th: 0.3048 },
  { id: "calacatta", label: "Calacatta marble", detail: "Warm gold veins, large-format slabs.", tex: "calacatta", texB: "", pattern: "grid", tw: 0.6096, th: 0.3048 },
  { id: "slate", label: "Slate", detail: "Cleft stone with a natural variation.", tex: "slate", texB: "", pattern: "grid", tw: 0.4064, th: 0.4064 },
  { id: "terracotta", label: "Terracotta", detail: "Warm clay tiles and a wider joint.", tex: "terracotta", texB: "", pattern: "grid", tw: 0.3048, th: 0.3048 },
  { id: "subway", label: "Subway", detail: "Classic 3 × 6 ceramic, half-offset.", tex: "subway", texB: "", pattern: "offset", tw: 0.1524, th: 0.0762, offset: 0.5 },
  { id: "hex", label: "Hex mosaic", detail: "Small marble hexagons.", tex: "carrara", texB: "", pattern: "hex", tw: 0.032, th: 0.032 },
  { id: "square-mosaic", label: "Square mosaic", detail: "One-inch stone squares.", tex: "carrara", texB: "", pattern: "grid", tw: 0.0254, th: 0.0254 },
  { id: "herringbone-tile", label: "Herringbone tile", detail: "Narrow marble in a zigzag.", tex: "carrara", texB: "", pattern: "herringbone", tw: 0.1524, th: 0.0508 },
  { id: "chevron-tile", label: "Chevron tile", detail: "Mitered marble in a continuous V.", tex: "carrara", texB: "", pattern: "chevron", tw: 0.1524, th: 0.0508 },
  { id: "checkerboard", label: "Checkerboard", detail: "Alternating light marble and slate.", tex: "carrara", texB: "slate", pattern: "checker", tw: 0.3048, th: 0.3048 },
] as const;

export const grouts = [
  { id: "white", label: "White", color: "#f4f1ea" },
  { id: "grey", label: "Grey", color: "#b9b4ae" },
  { id: "charcoal", label: "Charcoal", color: "#3a3a3c" },
] as const;

export const groutWidths = [
  { id: "tight", label: "Tight", meters: 0.0016 },
  { id: "standard", label: "Standard", meters: 0.0032 },
  { id: "wide", label: "Wide", meters: 0.0064 },
] as const;

export const sheenParams = {
  matte: { roughness: 0.78, clearcoat: 0.0, clearcoatRoughness: 1.0, env: 0.05 },
  satin: { roughness: 0.42, clearcoat: 0.16, clearcoatRoughness: 0.48, env: 0.32 },
  semi: { roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.12, env: 0.82 },
  gloss: { roughness: 0.035, clearcoat: 1.0, clearcoatRoughness: 0.025, env: 1.22 },
} as const;

export function speciesMaps(id: string) {
  const base = species.find((s) => s.id === id)?.base ?? "white-oak";
  return {
    color: `/textures/${base}/color.webp`,
    normal: `/textures/${base}/normal.webp`,
    rough: `/textures/${base}/rough.webp`,
    card: `/textures/${base}/card.webp`,
  };
}

export function tileMaps(id: string) {
  const style = tileStyles.find((item) => item.id === id);
  const tex = style?.tex ?? "carrara";
  return {
    color: `/textures/${tex}/color.webp`,
    normal: `/textures/${tex}/normal.webp`,
    rough: `/textures/${tex}/rough.webp`,
    card: `/textures/${tex}/card.webp`,
    alt: style?.texB ? `/textures/${style.texB}/color.webp` : null,
  };
}

export function groutGap(id?: string) {
  return groutWidths.find((item) => item.id === id)?.meters ?? 0.0032;
}

export function stainColor(mode: "sealer" | "stain", id: string) {
  const list = mode === "sealer" ? sealers : stains;
  return (list.find((item) => item.id === id)?.color ?? "#d2c19a") as string;
}

export type SpeciesId = (typeof species)[number]["id"];
export type PatternId = (typeof patterns)[number]["id"];
export type StainId = (typeof stains)[number]["id"];
export type SealerId = (typeof sealers)[number]["id"];
export type SheenId = (typeof sheens)[number]["id"];
export type TileStyleId = (typeof tileStyles)[number]["id"];
export type GroutId = (typeof grouts)[number]["id"];
export type GroutWidthId = (typeof groutWidths)[number]["id"];
export type JobId = "new" | "refinish";
export type FamilyId = "hardwood" | "tile";
export type WoodMode = "sealer" | "stain";
export type CameraView = "floor" | "closeup";
