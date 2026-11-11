import { defaultRateCard } from "@/config/default-rate-card";
import type { RateCard } from "./types";

export const RATE_CARD_STORAGE_KEY = "vipro-rate-card-v1";

export function cloneDefaultRateCard(): RateCard {
  return JSON.parse(JSON.stringify(defaultRateCard)) as RateCard;
}

export function loadRateCard(): RateCard {
  if (typeof window === "undefined") return cloneDefaultRateCard();
  try {
    const raw = window.localStorage.getItem(RATE_CARD_STORAGE_KEY);
    if (!raw) return cloneDefaultRateCard();
    const parsed = JSON.parse(raw) as RateCard;
    return { ...cloneDefaultRateCard(), ...parsed, packages: { ...cloneDefaultRateCard().packages, ...parsed.packages }, extras: { ...cloneDefaultRateCard().extras, ...parsed.extras }, minimums: { ...cloneDefaultRateCard().minimums, ...parsed.minimums }, tax: { ...cloneDefaultRateCard().tax, ...parsed.tax }, waste: { ...cloneDefaultRateCard().waste, ...parsed.waste } };
  } catch {
    return cloneDefaultRateCard();
  }
}

export function saveRateCard(card: RateCard) {
  window.localStorage.setItem(RATE_CARD_STORAGE_KEY, JSON.stringify(card));
  window.dispatchEvent(new Event("vipro-rate-card-changed"));
}

export function resetRateCard() {
  window.localStorage.removeItem(RATE_CARD_STORAGE_KEY);
  window.dispatchEvent(new Event("vipro-rate-card-changed"));
}
