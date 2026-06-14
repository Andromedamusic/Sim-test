/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS — home/default context, data export-import (portable JSON), optional
   Claude API key (for the live second-opinion), meter-source adapters, cloud
   sync, and offline storage status.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useState } from "react";
import { useStore } from "../../state/store";
import { type Era, type WireMaterial } from "../../core";
import { exportHome, downloadJSON, getSetting, setSetting, putHome } from "../../data/storage";
import { storageEstimate, requestPersistence } from "../../data/db";
import { C, mono, sans, HUD, glow } from "../theme";
import { Field, TextInput, Select, SectionHeader, HudPanel } from "../components";
import { METER_NAMES, METERS } from "../meters";
import { AdapterPanel } from "../components/AdapterPanel";
import { useReducedMotion } from "../anim";
import { OIcon } from "../icons/OIcon";

const ERAS: Era[] = ["Pre-1990", "1990-2000", "2000-2010", "2010+", "Unknown"];
const WIRES: WireMaterial[] = ["Copper", "Aluminum", "Unknown"];

// ─── Relative time helper ─────────────────────────────────────────────────────

function relTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return iso;
  }
}

// ─── Styled input helpers ─────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: "#060A0F",
  border: `1px solid ${HUD.line}`,
  borderRadius: 7,
  padding: "9px 10px",
  fontFamily: mono,
  fontSize: 12,
  color: HUD.text,
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color .15s, box-shadow .15s",
  outline: "none",
};

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: color + "18",
      border: `1px solid ${color}44`,
      borderRadius: 5,
      padding: "2px 8px",
      fontFamily: mono,
      fontSize: 10,
      fontWeight: 700,
      color,
    }}>
      {children}
    </span>
  );
}

// ─── SpinnerInline — reduced-motion gated ────────────────────────────────────

function SpinnerInline() {
  const rm = useReducedMotion();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        animation: rm ? undefined : "oi-spin 0.8s linear infinite",
      }}
    >
      <style>{`@keyframes oi-spin { to { transform: rotate(360deg); } }`}</style>
      <OIcon name="sync" size={11} color="currentColor" />
    </span>
  );
}

// ─── Cloud Sync Card ──────────────────────────────────────────────────────────

function CloudSyncCard() {
  const syncConfig = useStore((s) => s.syncConfig);
  const syncStatus = useStore((s) => s.syncStatus);
  const setSyncConfig = useStore((s) => s.setSyncConfig);
  const syncNow = useStore((s) => s.syncNow);

  const [url, setUrl] = useState(syncConfig?.url ?? "");
  const [token, setToken] = useState(syncConfig?.token ?? "");
  const [saved, setSaved] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const [tokenFocused, setTokenFocused] = useState(false);

  // keep local inputs in sync when store changes externally
  useEffect(() => {
    setUrl(syncConfig?.url ?? "");
    setToken(syncConfig?.token ?? "");
  }, [syncConfig]);

  async function handleSave() {
    const trimmedUrl = url.trim();
    await setSyncConfig(trimmedUrl ? { url: trimmedUrl, token: token.trim() || undefined } : null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const syncing = syncStatus.state === "syncing";

  const statusChip = (() => {
    switch (syncStatus.state) {
      case "syncing":
        return (
          <StatusChip color={C.blue}>
            <SpinnerInline /> SYNCING
          </StatusChip>
        );
      case "ok":
        return (
          <StatusChip color={C.good}>
            <OIcon name="check" size={12} color={C.good} /> {syncStatus.message ?? "SYNCED"}
            {syncStatus.at ? <span style={{ color: C.dim, fontWeight: 400 }}>&nbsp;· {relTime(syncStatus.at)}</span> : null}
          </StatusChip>
        );
      case "error":
        return (
          <StatusChip color={C.bad}>
            <OIcon name="cross" size={12} color={C.bad} /> {syncStatus.message ?? "SYNC FAILED"}
          </StatusChip>
        );
      default:
        return <StatusChip color={HUD.dimmer}>IDLE</StatusChip>;
    }
  })();

  return (
    <HudPanel>
      <SectionHeader label="Cloud Sync" />
      {/* prose: sans for readability */}
      <p style={{ color: C.dim, fontSize: 12, fontFamily: sans, margin: "0 0 12px", lineHeight: 1.6 }}>
        Offline-first — sync is entirely optional. When configured, it PUT/GETs one JSON file per home to
        any endpoint you control (S3 pre-signed URL, a small server, a Cloudflare Worker). Last-write-wins
        by timestamp. The deterministic diagnostic engine never needs network access.
      </p>

      <div style={{ display: "grid", gap: 9 }}>
        <Field label="ENDPOINT URL">
          <input
            type="text"
            value={url}
            placeholder="https://…/homes/{id}.json"
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setUrlFocused(true)}
            onBlur={() => setUrlFocused(false)}
            style={{
              ...inputBase,
              borderColor: urlFocused ? HUD.cyan : HUD.line,
              boxShadow: urlFocused ? glow(HUD.cyan, 0.3) : undefined,
            }}
          />
        </Field>

        <Field label="ACCESS TOKEN (optional)">
          <input
            type="password"
            value={token}
            placeholder="Bearer token or API key"
            onChange={(e) => setToken(e.target.value)}
            onFocus={() => setTokenFocused(true)}
            onBlur={() => setTokenFocused(false)}
            style={{
              ...inputBase,
              borderColor: tokenFocused ? HUD.cyan : HUD.line,
              boxShadow: tokenFocused ? glow(HUD.cyan, 0.3) : undefined,
            }}
          />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleSave} className="oi-press" style={{ ...solid(C.blue), display: "inline-flex", alignItems: "center", gap: 5 }}>
            {saved ? <><OIcon name="check" size={12} color="#0A0A0C" /> Saved</> : "Save"}
          </button>
          <button
            onClick={() => syncNow()}
            disabled={syncing || !syncConfig}
            className="oi-press"
            style={{ ...solid(C.amber), opacity: syncing || !syncConfig ? 0.45 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <OIcon name="sync" size={13} color="#0A0A0C" /> Sync now
          </button>
          {statusChip}
        </div>
      </div>

      <div style={{ marginTop: 10, color: C.dim, fontSize: 11, fontFamily: mono, lineHeight: 1.5 }}>
        Leave URL empty to disable cloud sync and clear saved config. Tokens are stored in this browser only.
      </div>
    </HudPanel>
  );
}

export function SettingsView() {
  const { model, importDoc, reloadModel } = useStore();
  const [apiKey, setApiKey] = useState("");
  const [apiFocused, setApiFocused] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [msg, setMsg] = useState("");
  const rm = useReducedMotion();

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
      try { await importDoc(JSON.parse(String(reader.result))); setMsg("ok:Imported home model."); }
      catch (err) { setMsg("err:Import failed: " + (err as Error).message); }
    };
    reader.readAsText(file);
  };

  const storageUsage = storage
    ? `${(storage.usage / 1e6).toFixed(1)} MB${storage.quota ? ` / ${(storage.quota / 1e6).toFixed(0)} MB` : ""}`
    : null;

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720, padding: "4px 0" }}>

      {/* ── HOME ──────────────────────────────────────────────────────── */}
      <HudPanel>
        <SectionHeader label="Home" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 12 }}>
          <Field label="Home name">
            <TextInput value={home.name} onChange={(v) => saveHome({ name: v })} />
          </Field>
        </div>

        <div style={{ borderTop: `1px solid ${HUD.line}`, paddingTop: 12, marginTop: 4 }}>
          <SectionHeader label="Default Context" sub="— applied to new outlets" style={{ marginBottom: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
            <Field label="Build era"><Select value={dm.era} options={ERAS} onChange={(v) => saveMeta({ era: v })} /></Field>
            <Field label="Wire material"><Select value={dm.wireMat} options={WIRES} onChange={(v) => saveMeta({ wireMat: v })} /></Field>
            <Field label="Meter"><Select value={dm.meter} options={METER_NAMES} onChange={(v) => saveMeta({ meter: v, meterZ: METERS[v].z })} /></Field>
          </div>
        </div>
      </HudPanel>

      {/* ── DATA ──────────────────────────────────────────────────────── */}
      <HudPanel>
        <SectionHeader label="Data — Portable &amp; Offline-First" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={doExport} className="oi-press" style={{ ...solid(C.good), display: "inline-flex", alignItems: "center", gap: 5 }}>
            <OIcon name="export" size={13} color="#0A0A0C" /> Export home JSON
          </button>
          <label className="oi-press" style={{ ...solid(C.blue), display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <OIcon name="import" size={13} color="#0A0A0C" /> Import JSON
            <input type="file" accept="application/json" onChange={doImport} style={{ display: "none" }} />
          </label>
        </div>
        {msg && (
          <div className={rm ? undefined : "oi-fadeup"} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, color: msg.startsWith("ok:") ? C.good : C.bad, fontSize: 11, fontFamily: mono }}>
            {msg.startsWith("ok:") ? <OIcon name="check" size={12} color={C.good} /> : <OIcon name="cross" size={12} color={C.bad} />}
            {msg.startsWith("ok:") ? msg.slice(3) : msg.startsWith("err:") ? msg.slice(4) : msg}
          </div>
        )}
        <div style={{ color: C.dim, fontSize: 11, fontFamily: mono, lineHeight: 1.5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          All data lives in this browser (IndexedDB) — zero network required.
          {storageUsage && (
            <StatusChip color={HUD.cyan}>
              {storageUsage}
            </StatusChip>
          )}
          <button
            onClick={() => requestPersistence().then((ok) => setMsg(ok ? "ok:Persistent storage granted." : "err:Persistence not granted."))}
            style={ghost(C.dim)}
          >
            Request durable storage
          </button>
        </div>
      </HudPanel>

      {/* ── AI KEY ────────────────────────────────────────────────────── */}
      <HudPanel>
        <SectionHeader label="AI Second Opinion — Optional Live Key" />
        <Field label="Anthropic API key (stored locally only)">
          <input
            type="password"
            value={apiKey}
            placeholder="sk-ant-…"
            onChange={(e) => setApiKey(e.target.value)}
            onFocus={() => setApiFocused(true)}
            onBlur={() => { setApiFocused(false); setSetting("anthropicApiKey", apiKey); }}
            style={{
              ...inputBase,
              borderColor: apiFocused ? HUD.cyan : HUD.line,
              boxShadow: apiFocused ? glow(HUD.cyan, 0.3) : undefined,
            }}
          />
        </Field>
        <div style={{ marginTop: 8, color: C.dim, fontSize: 11, fontFamily: mono, lineHeight: 1.5 }}>
          Optional. The deterministic engine never needs this. With a key + connectivity, the Diagnose tab can
          call Claude for a second opinion; without it, use "Copy report → Claude". The key is stored only in this browser.
        </div>
      </HudPanel>

      {/* ── METER SOURCE ──────────────────────────────────────────────── */}
      <HudPanel>
        <SectionHeader label="Meter Source — Manual Entry + Experimental Hardware" />
        <AdapterPanel />
      </HudPanel>

      {/* ── CLOUD SYNC ────────────────────────────────────────────────── */}
      <CloudSyncCard />

      {/* ── Disclaimer ────────────────────────────────────────────────── */}
      <div style={{ color: C.dim, fontSize: 11, fontFamily: sans, lineHeight: 1.6, padding: "0 4px" }}>
        Diagnostic support only. De-energize before opening an outlet or performing continuity/resistance checks. This tool does not replace a licensed electrician.
      </div>
    </div>
  );
}

const solid = (c: string): React.CSSProperties => ({
  background: c,
  color: "#0A0A0C",
  border: "none",
  borderRadius: 8,
  padding: "9px 13px",
  fontWeight: 700,
  fontFamily: mono,
  fontSize: 12,
  cursor: "pointer",
});
const ghost = (c: string): React.CSSProperties => ({
  background: "transparent",
  color: c,
  border: `1px solid ${c}`,
  borderRadius: 6,
  padding: "5px 9px",
  fontFamily: mono,
  fontSize: 11,
  cursor: "pointer",
});
