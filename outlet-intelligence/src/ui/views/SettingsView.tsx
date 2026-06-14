/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS — home/default context, data export-import (portable JSON), optional
   Claude API key (for the live second-opinion), meter-source adapters, and
   offline storage status.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useState } from "react";
import { useStore } from "../../state/store";
import { type Era, type WireMaterial } from "../../core";
import { exportHome, downloadJSON, getSetting, setSetting, putHome } from "../../data/storage";
import { storageEstimate, requestPersistence } from "../../data/db";
import { C, mono } from "../theme";
import { Card, Field, TextInput, Select, SubH } from "../components";
import { METER_NAMES, METERS } from "../meters";
import { AdapterPanel } from "../components/AdapterPanel";

const ERAS: Era[] = ["Pre-1990", "1990-2000", "2000-2010", "2010+", "Unknown"];
const WIRES: WireMaterial[] = ["Copper", "Aluminum", "Unknown"];

export function SettingsView() {
  const { model, importDoc, reloadModel } = useStore();
  const [apiKey, setApiKey] = useState("");
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getSetting<string>("anthropicApiKey", "").then(setApiKey);
    storageEstimate().then(setStorage);
  }, []);

  if (!model) return null;
  const home = model.home;
  const dm = home.defaultMeta;
  const saveHome = (patch: Partial<typeof home>) => { putHome({ ...home, ...patch }); reloadModel(); };
  const saveMeta = (patch: Partial<typeof dm>) => saveHome({ defaultMeta: { ...dm, ...patch } });

  const doExport = async () => {
    const doc = await exportHome(home.id);
    if (doc) downloadJSON(`home_${home.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`, doc);
  };
  const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try { await importDoc(JSON.parse(String(reader.result))); setMsg("✓ Imported home model."); }
      catch (err) { setMsg("✗ Import failed: " + (err as Error).message); }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <Card title="HOME">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
          <Field label="Home name"><TextInput value={home.name} onChange={(v) => saveHome({ name: v })} /></Field>
        </div>
        <SubH text="Default context (applied to new outlets)" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
          <Field label="Build era"><Select value={dm.era} options={ERAS} onChange={(v) => saveMeta({ era: v })} /></Field>
          <Field label="Wire material"><Select value={dm.wireMat} options={WIRES} onChange={(v) => saveMeta({ wireMat: v })} /></Field>
          <Field label="Meter"><Select value={dm.meter} options={METER_NAMES} onChange={(v) => saveMeta({ meter: v, meterZ: METERS[v].z })} /></Field>
        </div>
      </Card>

      <Card title="DATA — portable & offline-first">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={doExport} style={solid(C.good)}>⬇ Export home JSON</button>
          <label style={{ ...solid(C.blue), display: "inline-block" }}>⬆ Import JSON
            <input type="file" accept="application/json" onChange={doImport} style={{ display: "none" }} />
          </label>
        </div>
        {msg && <div style={{ marginTop: 8, color: C.dim, fontSize: 11, fontFamily: mono }}>{msg}</div>}
        <div style={{ marginTop: 10, color: C.dimmer, fontSize: 10, fontFamily: mono, lineHeight: 1.5 }}>
          All data lives in this browser (IndexedDB) and works with zero network. Export is the portable interchange unit — email it, back it up, or load it into the dashboard.
          {storage && <> · using {(storage.usage / 1e6).toFixed(1)}MB{storage.quota ? ` of ${(storage.quota / 1e6).toFixed(0)}MB` : ""}</>}
          <button onClick={() => requestPersistence().then((ok) => setMsg(ok ? "✓ Persistent storage granted." : "Persistence not granted."))} style={{ ...ghost(C.dim), marginLeft: 8 }}>Request durable storage</button>
        </div>
      </Card>

      <Card title="AI SECOND OPINION — optional live key">
        <Field label="Anthropic API key (stored locally only)">
          <input type="password" value={apiKey} placeholder="sk-ant-…" onChange={(e) => setApiKey(e.target.value)}
            onBlur={() => setSetting("anthropicApiKey", apiKey)}
            style={{ background: "#0A0A0E", border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 10px", fontFamily: mono, fontSize: 12 }} />
        </Field>
        <div style={{ marginTop: 8, color: C.dimmer, fontSize: 10, fontFamily: mono, lineHeight: 1.5 }}>
          Optional. The deterministic engine never needs this. With a key + connectivity, the Diagnose tab can call Claude for a second opinion; without it, use “Copy report → Claude”. The key is stored only in this browser.
        </div>
      </Card>

      <Card title="METER SOURCE — manual entry + experimental hardware">
        <AdapterPanel />
      </Card>

      <div style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, lineHeight: 1.6, padding: "0 4px" }}>
        Diagnostic support only. De-energize before opening an outlet or performing continuity/resistance checks. This tool does not replace a licensed electrician.
      </div>
    </div>
  );
}

const solid = (c: string): React.CSSProperties => ({ background: c, color: "#0A0A0C", border: "none", borderRadius: 8, padding: "9px 13px", fontWeight: 700, fontFamily: mono, fontSize: 12, cursor: "pointer" });
const ghost = (c: string): React.CSSProperties => ({ background: "transparent", color: c, border: `1px solid ${c}`, borderRadius: 6, padding: "5px 9px", fontFamily: mono, fontSize: 10, cursor: "pointer" });
