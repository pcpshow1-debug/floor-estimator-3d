"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultRateCard } from "@/config/default-rate-card";
import { ADMIN_SESSION_KEY, verifyAdminPassword } from "@/lib/pricing/auth";
import { loadRateCard, resetRateCard, saveRateCard } from "@/lib/pricing/store";
import type { RateCard, RateRange } from "@/lib/pricing/types";

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function RateEditor({
  title,
  group,
  card,
  onChange,
}: {
  title: string;
  group: "packages" | "extras";
  card: RateCard;
  onChange: (next: RateCard) => void;
}) {
  const items = Object.values(card[group]);
  return (
    <section className="admin-section">
      <h2>{title}</h2>
      {items.map((rate) => (
        <article key={rate.id} className="admin-rate">
          <header>
            <h3>{rate.label}</h3>
            <span>{rate.approved ? "Approved" : rate.placeholder ? "Unapproved placeholder" : "Provisional / unapproved"}</span>
          </header>
          <div className="admin-grid">
            <label>Low<input value={rate.low ?? ""} onChange={(e) => update(rate.id, { low: numOrNull(e.target.value) })} /></label>
            <label>High<input value={rate.high ?? ""} onChange={(e) => update(rate.id, { high: numOrNull(e.target.value) })} /></label>
            <label>Units
              <select value={rate.units} onChange={(e) => update(rate.id, { units: e.target.value as RateRange["units"] })}>
                <option value="usd_per_sqft">USD / sq ft</option>
                <option value="usd_per_lf">USD / linear ft</option>
                <option value="usd_per_item">USD / item</option>
                <option value="usd_fixed">USD fixed</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={Boolean(rate.approved)} onChange={(e) => update(rate.id, { approved: e.target.checked })} /> Approved by Vlad</label>
            <label className="check"><input type="checkbox" checked={Boolean(rate.requiresAssessment)} onChange={(e) => update(rate.id, { requiresAssessment: e.target.checked })} /> Requires assessment</label>
            <label className="check"><input type="checkbox" checked={Boolean(rate.highIsOpen)} onChange={(e) => update(rate.id, { highIsOpen: e.target.checked })} /> High is open-ended ($N+)</label>
            <label className="wide">Scope<textarea value={rate.scope} onChange={(e) => update(rate.id, { scope: e.target.value })} /></label>
            <label className="wide">Inclusions (one per line)<textarea value={rate.inclusions.join("\n")} onChange={(e) => update(rate.id, { inclusions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></label>
            <label className="wide">Notes<textarea value={rate.notes ?? ""} onChange={(e) => update(rate.id, { notes: e.target.value })} /></label>
            <label className="wide">Source<input value={rate.source} onChange={(e) => update(rate.id, { source: e.target.value })} /></label>
            <label className="wide">Source URL (leave blank if none)<input value={rate.sourceUrl ?? ""} onChange={(e) => update(rate.id, { sourceUrl: e.target.value || null })} /></label>
            <label>As of<input value={rate.asOf} onChange={(e) => update(rate.id, { asOf: e.target.value })} /></label>
          </div>
        </article>
      ))}
    </section>
  );

  function update(id: string, patch: Partial<RateRange>) {
    onChange({
      ...card,
      [group]: {
        ...card[group],
        [id]: { ...card[group][id], ...patch },
      },
    });
  }
}

export function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<RateCard>(defaultRateCard);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      setAuthed(true);
      setCard(loadRateCard());
    }
  }, []);

  const json = useMemo(() => JSON.stringify(card, null, 2), [card]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ok = await verifyAdminPassword(password);
      if (!ok) {
        setError("That password did not match.");
        return;
      }
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      setAuthed(true);
      setCard(loadRateCard());
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="admin-login">
        <h1>VIPRO rate card</h1>
        <p>Edit every benchmark, inclusion, minimum, and surcharge without changing code.</p>
        <form onSubmit={login}>
          <label>
            Admin password
            <input type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="err">{error}</p>}
          <button type="submit" className="continue" disabled={busy}>{busy ? "Checking…" : "Open admin"}</button>
        </form>
        <p className="note"><a href="/">Back to estimator</a></p>
      </main>
    );
  }

  return (
    <main className="admin-app">
      <header className="admin-top">
        <div>
          <p className="demo-flag">Admin</p>
          <h1>Editable rate card</h1>
          <p className="note">Stored in this browser until you download JSON or reset to the shipped defaults. Source on provisional lines is “David Zuev provisional benchmarks, Nov 10 2026” unless you replace it with a real public URL — do not invent URLs.</p>
        </div>
        <div className="admin-actions">
          <button type="button" className="pill on" onClick={() => { saveRateCard(card); setSaved("Saved to this browser. The estimator will use these figures immediately."); }}>Save</button>
          <button type="button" className="pill" onClick={() => {
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "vipro-rate-card.json";
            a.click();
            URL.revokeObjectURL(url);
          }}>Download JSON</button>
          <label className="pill">Import JSON
            <input hidden type="file" accept="application/json" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const next = JSON.parse(await file.text()) as RateCard;
                setCard(next);
                setSaved("Imported. Click Save to apply.");
              } catch {
                setSaved("That file was not valid JSON.");
              }
            }} />
          </label>
          <button type="button" className="pill" onClick={() => { resetRateCard(); setCard(JSON.parse(JSON.stringify(defaultRateCard))); setSaved("Reset to shipped provisional defaults."); }}>Reset defaults</button>
          <a className="pill" href="/">Estimator</a>
        </div>
      </header>
      {saved && <p className="note" role="status">{saved}</p>}

      <section className="admin-section">
        <h2>Card</h2>
        <div className="admin-grid">
          <label className="wide">Disclaimer<textarea value={card.disclaimer} onChange={(e) => setCard({ ...card, disclaimer: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={card.approvedByVlad} onChange={(e) => setCard({ ...card, approvedByVlad: e.target.checked })} /> Entire card approved by Vlad</label>
          <label>Default source<input value={card.defaultSource} onChange={(e) => setCard({ ...card, defaultSource: e.target.value })} /></label>
          <label>As of<input value={card.asOf} onChange={(e) => setCard({ ...card, asOf: e.target.value })} /></label>
        </div>
      </section>

      <RateEditor title="Packages" group="packages" card={card} onChange={setCard} />
      <RateEditor title="Extras, patterns, stairs, repairs" group="extras" card={card} onChange={setCard} />

      <section className="admin-section">
        <h2>Waste</h2>
        <div className="admin-grid">
          <label>Straight low %<input value={card.waste.straight.low * 100} onChange={(e) => setCard({ ...card, waste: { ...card.waste, straight: { ...card.waste.straight, low: Number(e.target.value) / 100 } } })} /></label>
          <label>Straight high %<input value={card.waste.straight.high * 100} onChange={(e) => setCard({ ...card, waste: { ...card.waste, straight: { ...card.waste.straight, high: Number(e.target.value) / 100 } } })} /></label>
          <label>Diagonal / herringbone low %<input value={card.waste.diagonalHerringbone.low * 100} onChange={(e) => setCard({ ...card, waste: { ...card.waste, diagonalHerringbone: { ...card.waste.diagonalHerringbone, low: Number(e.target.value) / 100 } } })} /></label>
          <label>Diagonal / herringbone high %<input value={card.waste.diagonalHerringbone.high * 100} onChange={(e) => setCard({ ...card, waste: { ...card.waste, diagonalHerringbone: { ...card.waste.diagonalHerringbone, high: Number(e.target.value) / 100 } } })} /></label>
        </div>
      </section>

      <section className="admin-section">
        <h2>Small-job minimum</h2>
        <div className="admin-grid">
          <label>Amount (USD)<input value={card.minimums.smallJob.low ?? ""} onChange={(e) => {
            const amount = numOrNull(e.target.value);
            setCard({ ...card, minimums: { ...card.minimums, smallJob: { ...card.minimums.smallJob, low: amount, high: amount } } });
          }} /></label>
          <label className="check"><input type="checkbox" checked={Boolean(card.minimums.smallJob.placeholder)} onChange={(e) => setCard({ ...card, minimums: { ...card.minimums, smallJob: { ...card.minimums.smallJob, placeholder: e.target.checked } } })} /> Marked as unapproved placeholder</label>
          <label className="check"><input type="checkbox" checked={Boolean(card.minimums.smallJob.approved)} onChange={(e) => setCard({ ...card, minimums: { ...card.minimums, smallJob: { ...card.minimums.smallJob, approved: e.target.checked } } })} /> Approved</label>
          <label className="wide">Notes<textarea value={card.minimums.smallJob.notes ?? ""} onChange={(e) => setCard({ ...card, minimums: { ...card.minimums, smallJob: { ...card.minimums.smallJob, notes: e.target.value } } })} /></label>
          <label className="wide">Source<input value={card.minimums.smallJob.source} onChange={(e) => setCard({ ...card, minimums: { ...card.minimums, smallJob: { ...card.minimums.smallJob, source: e.target.value } } })} /></label>
        </div>
      </section>

      <section className="admin-section">
        <h2>Washington sales tax</h2>
        <p className="note">{card.tax.note}</p>
        <p className="note"><a href={card.tax.docsUrl} target="_blank" rel="noreferrer">WA DOR URL interface</a> · lookup <code>{card.tax.lookupUrl}</code></p>
        <div className="admin-grid">
          <label>Confirmed destination rate (decimal, e.g. 0.1055)<input value={card.tax.overrideRate ?? ""} onChange={(e) => setCard({ ...card, tax: { ...card.tax, overrideRate: numOrNull(e.target.value) } })} /></label>
          <label className="check"><input type="checkbox" checked={card.tax.overrideConfirmed} onChange={(e) => setCard({ ...card, tax: { ...card.tax, overrideConfirmed: e.target.checked } })} /> Rate confirmed after a destination lookup</label>
        </div>
      </section>
    </main>
  );
}
