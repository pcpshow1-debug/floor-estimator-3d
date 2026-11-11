import type { TaxResult } from "./types";

export const DOR_LOOKUP = "https://webgis.dor.wa.gov/webapi/AddressRates.aspx";
export const DOR_DOCS = "https://dor.wa.gov/wa-sales-tax-rate-lookup-url-interface";
export const DOR_TOOLS = "https://dor.wa.gov/taxes-rates/sales-use-tax-rates/sales-and-use-tax-tools";

const ADDRESS_OK = new Set([0, 2, 3, 4]);

export function parseDorText(text: string): { locationCode: string | null; rate: number | null; resultCode: number | null } {
  const loc = text.match(/LocationCode=(\S+)/i)?.[1] ?? null;
  const rateRaw = text.match(/Rate=(\S+)/i)?.[1] ?? null;
  const codeRaw = text.match(/ResultCode=(\S+)/i)?.[1] ?? null;
  const rate = rateRaw != null ? Number(rateRaw) : null;
  const resultCode = codeRaw != null ? Number(codeRaw) : null;
  return {
    locationCode: loc,
    rate: rate != null && Number.isFinite(rate) ? rate : null,
    resultCode: resultCode != null && Number.isFinite(resultCode) ? resultCode : null,
  };
}

export function interpretDorLookup(opts: {
  rate: number | null;
  resultCode: number | null;
  locationCode?: string | null;
  period?: string | null;
  jurisdiction?: string | null;
  hasStreet: boolean;
}): TaxResult {
  const base = {
    rate: opts.rate,
    locationCode: opts.locationCode ?? null,
    resultCode: opts.resultCode,
    period: opts.period ?? null,
    jurisdiction: opts.jurisdiction ?? null,
    source: `${DOR_LOOKUP} (WA DOR AddressRates)`,
  };
  if (opts.resultCode === 6 || opts.resultCode === 9 || opts.resultCode === 7) {
    return {
      ...base,
      confirmed: false,
      note: "WA DOR could not locate this destination. Sales tax is unconfirmed.",
    };
  }
  if (opts.resultCode != null && ADDRESS_OK.has(opts.resultCode) && opts.rate != null && opts.hasStreet) {
    return {
      ...base,
      confirmed: true,
      note: `Confirmed destination-specific combined rate from WA DOR (result code ${opts.resultCode}). Residential construction can be taxable including labor; verify taxability of the full contract.`,
    };
  }
  if (opts.resultCode === 5 || (opts.rate != null && !opts.hasStreet)) {
    return {
      ...base,
      confirmed: false,
      rate: opts.rate,
      note: `WA DOR returned a ZIP-level rate of ${opts.rate != null ? (opts.rate * 100).toFixed(2) + "%" : "unknown"} (result code ${opts.resultCode ?? "n/a"}). A 5-digit ZIP can contain more than one local rate, so this is not a confirmed destination-specific rate and is not applied to the total. Enter a street address or confirm a rate in admin.`,
    };
  }
  if (opts.rate != null && opts.resultCode === 1 && opts.hasStreet) {
    return {
      ...base,
      confirmed: false,
      note: "WA DOR located a ZIP+4 but not the full address (result code 1). Tax is left unconfirmed until the address is validated.",
    };
  }
  return {
    ...base,
    confirmed: false,
    note: "Sales tax is unconfirmed. Use the WA DOR destination lookup with a street address, or mark a rate confirmed in admin.",
  };
}

export async function lookupWaDorTax(input: { zip?: string; streetAddress?: string; city?: string }): Promise<TaxResult> {
  const zip = (input.zip ?? "").replace(/\D/g, "").slice(0, 9);
  const addr = (input.streetAddress ?? "").trim();
  const city = (input.city ?? "").trim();
  if (zip.length < 5) {
    return {
      confirmed: false,
      rate: null,
      source: DOR_LOOKUP,
      note: "Enter a Washington ZIP (and ideally a street address) to look up the destination-specific WA DOR sales tax rate. Tax is unconfirmed.",
    };
  }
  const url = `${DOR_LOOKUP}?output=text&addr=${encodeURIComponent(addr)}&city=${encodeURIComponent(city)}&zip=${encodeURIComponent(zip)}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    const parsed = parseDorText(text);
    return interpretDorLookup({ ...parsed, hasStreet: addr.length > 0 });
  } catch {
    return {
      confirmed: false,
      rate: null,
      source: DOR_LOOKUP,
      note: `Could not reach the WA DOR lookup (${DOR_LOOKUP}). Sales tax is unconfirmed. Public tool: ${DOR_TOOLS}.`,
    };
  }
}
