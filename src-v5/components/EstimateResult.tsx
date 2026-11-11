"use client";

import type { EstimateResult } from "@/lib/pricing/types";

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function range(low: number | null | undefined, high: number | null | undefined) {
  if (low == null && high == null) return "requires assessment";
  if (low != null && high == null) return `${money(low)} – requires assessment`;
  if (low == null && high != null) return `requires assessment – ${money(high)}`;
  return `${money(low)} – ${money(high)}`;
}

export function EstimateResultView({ estimate }: { estimate: EstimateResult }) {
  return (
    <div className="estimate-result">
      <p className="demo-flag">Preliminary</p>
      <h2>{estimate.headline}</h2>
      <p className="pending-copy">
        This is a preliminary estimate, subject to measurement and inspection.
      </p>
      <p className="price" aria-label="Estimated range">
        {range(estimate.incompleteLow ? null : estimate.subtotalLow, estimate.incompleteHigh ? null : estimate.subtotalHigh)}
      </p>
      <p className="size-area">Subtotal before tax · {range(estimate.incompleteLow ? null : estimate.subtotalLow, estimate.incompleteHigh ? null : estimate.subtotalHigh)}</p>
      <p className="size-area">
        Estimated total after tax ·{" "}
        {estimate.tax.confirmed ? range(estimate.totalLow, estimate.totalHigh) : "unconfirmed"}
      </p>
      {estimate.tax.confirmed && estimate.tax.rate != null && (
        <p className="note">
          Tax { (estimate.tax.rate * 100).toFixed(2) }% ({money(estimate.taxLow)}–{money(estimate.taxHigh)}) · {estimate.tax.jurisdiction || "WA DOR destination rate"}
          {estimate.tax.period ? ` · ${estimate.tax.period}` : ""}
        </p>
      )}
      {!estimate.tax.confirmed && <p className="note">{estimate.tax.note}</p>}

      <p className="section-label">Breakdown</p>
      <ul className="scope breakdown">
        {estimate.lines.map((line) => (
          <li key={line.id}>
            <span>
              {line.label}
              <small>
                {line.quantity} {line.quantityUnit} · {line.unitLabel}
                {line.inclusions.length ? ` · includes ${line.inclusions.join(", ")}` : ""}
              </small>
            </span>
            <strong>{range(line.low, line.high)}</strong>
          </li>
        ))}
      </ul>
      {estimate.lines.length === 0 && <p className="note">No priced lines yet. Missing details are listed below instead of a $0 total.</p>}

      {estimate.minimum.placeholder && estimate.minimum.configuredAmount != null && !estimate.minimum.applied && (
        <p className="note">
          If the unapproved placeholder minimum of {money(estimate.minimum.configuredAmount)} were applied once:{" "}
          {range(estimate.minimum.illustrativeLow, estimate.minimum.illustrativeHigh)}. That placeholder is not an approved VIPRO rate.
        </p>
      )}

      {estimate.flags.length > 0 && (
        <>
          <p className="section-label">Needs attention</p>
          <ul className="flag-list">
            {estimate.flags.map((flag) => (
              <li key={flag.id} data-severity={flag.severity}>
                <b>{flag.severity === "missing" ? "Missing" : flag.severity === "assessment" ? "Requires assessment" : "Note"}</b>
                {flag.message}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="section-label">Assumptions</p>
      <ul className="plain-list">
        {estimate.assumptions.map((item) => (
          <li key={item}>{item}</li>
        ))}
        <li>Net work area {estimate.netWorkAreaSqft} sq ft{estimate.wallOrShowerSqft > 0 ? `; shower/wall area ${estimate.wallOrShowerSqft} sq ft (separate)` : ""}.</li>
        {estimate.materialOrderQtyLow != null && (
          <li>
            Material order quantity (if buying material separately): {estimate.materialOrderQtyLow}–{estimate.materialOrderQtyHigh} sq ft
            using {((estimate.wastePercentLow ?? 0) * 100).toFixed(0)}–{((estimate.wastePercentHigh ?? 0) * 100).toFixed(0)}% waste. Labor uses net area.
          </li>
        )}
      </ul>

      <p className="section-label">Exclusions</p>
      <ul className="plain-list">
        {estimate.exclusions.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
