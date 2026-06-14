import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { rollupHome } from "../core";
import { C, mono, HUD, holoGrad, glow, GRADE_COLOR } from "./theme";
import { Pill, Sheet } from "./components";
import { MotionStyles, useReducedMotion } from "./anim";
import { ErrorBoundary } from "./ErrorBoundary";
import { Backdrop } from "./hud/Backdrop";
import { Boot } from "./hud/Boot";
import { Bracket } from "./hud/Bracket";
import { LiveDiagnostic } from "./pip/LiveDiagnostic";
import { HomeSwitcher } from "./components/HomeSwitcher";
import { ReportView } from "./views/ReportView";
import { InferenceView } from "./views/InferenceView";
import { FloorplanView } from "./views/FloorplanView";
import { HomeDashboardView } from "./views/HomeDashboardView";
import { AtlasView } from "./views/AtlasView";
import { PrognosisView } from "./views/PrognosisView";
import { ReferenceView } from "./views/ReferenceView";
import { SettingsView } from "./views/SettingsView";
import { PanelView } from "./views/PanelView";
import { LearningView } from "./views/LearningView";

type TabId = "home" | "map" | "diagnose" | "panel" | "atlas" | "prognosis" | "learning" | "report" | "ref" | "settings";
const PRIMARY: TabId[] = ["home", "map", "diagnose", "panel", "settings"];
const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "home", label: "Command", icon: "◉" },
  { id: "map", label: "Map", icon: "⬗" },
  { id: "diagnose", label: "Diagnose", icon: "⊹" },
  { id: "panel", label: "Panel", icon: "⊞" },
  { id: "atlas", label: "Atlas", icon: "❖" },
  { id: "prognosis", label: "Prognosis", icon: "⌁" },
  { id: "learning", label: "Learning", icon: "✸" },
  { id: "report", label: "Report", icon: "▤" },
  { id: "ref", label: "Reference", icon: "⌑" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function App() {
  const { ready, init, model, rev, memoryMode } = useStore();
  const [tab, setTab] = useState<TabId>("home");
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pip, setPip] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const health = useMemo(() => (model ? rollupHome(model) : null), [model, rev]);

  return (
    <div style={{ minHeight: "100vh", position: "relative", display: "flex", flexDirection: "column", paddingBottom: "calc(70px + env(safe-area-inset-bottom,0px))" }}>
      <MotionStyles />
      <Backdrop />
      <Boot />

      {!ready || !model ? (
        <div style={{ display: "grid", placeItems: "center", height: "100vh", color: C.dim, fontFamily: mono, position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center" }}>
            <div className="oi-spin-slow" style={{ width: 44, height: 44, margin: "0 auto 12px", borderRadius: "50%", border: `2px solid ${C.blue}22`, borderTopColor: C.blue }} />
            <div style={{ letterSpacing: 3, fontSize: 10 }}>INITIALIZING…</div>
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* ── HEADER ── */}
          <header style={{ background: "linear-gradient(180deg,rgba(7,11,18,0.92),rgba(7,11,18,0.66))", backdropFilter: "blur(10px)", borderBottom: `1px solid ${HUD.line}`, padding: "9px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", border: `2px solid ${C.blue}44`, borderTopColor: C.blue, boxShadow: `0 0 8px -2px ${C.blue}`, flexShrink: 0 }} />
              <span className="brandfull" style={{ fontFamily: mono, fontWeight: 800, fontSize: 14, letterSpacing: 1.2, background: holoGrad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", whiteSpace: "nowrap" }}>OUTLET&nbsp;INTELLIGENCE</span>
            </div>
            <HomeSwitcher />
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {health && <Pill color={GRADE_COLOR[health.grade]}>{health.safetyHold ? "⚠ HOLD" : health.grade}</Pill>}
              <button onClick={() => setPip((p) => !p)} title="Toggle live diagnostic" className="oi-press" style={{ ...hudCtl, color: pip ? C.blue : C.dim, borderColor: pip ? `${C.blue}66` : HUD.line, boxShadow: pip ? glow(C.blue, 0.4) : "none" }}>◳ LIVE</button>
              {memoryMode && <span title="IndexedDB unavailable — running in memory; export to save." style={{ fontSize: 9, fontFamily: mono, color: C.warn, letterSpacing: 1 }}>⚠ TEST</span>}
              <span className="hide-narrow" title={online ? "online" : "offline — engine fully functional"} style={{ fontSize: 9, fontFamily: mono, color: online ? C.good : C.dim, letterSpacing: 1 }}>{online ? "● ONLINE" : "○ OFFLINE"}</span>
            </div>
          </header>

          {/* ── COMMAND BAR ── */}
          <nav className="topnav" aria-label="Sections" style={{ display: "flex", gap: 5, padding: "8px 10px", background: "rgba(7,11,18,0.5)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${HUD.line}`, overflowX: "auto", position: "sticky", top: 47, zIndex: 25 }}>
            {TABS.map((t) => (
              <CommandTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} reduced={reduced} />
            ))}
          </nav>

          {/* ── CONTENT ── */}
          <main style={{ flex: 1, maxWidth: 1320, width: "100%", margin: "0 auto", padding: 14 }}>
            <div key={tab} className={reduced ? "" : "oi-fadeup"}>
              <ErrorBoundary key={tab}>
                {tab === "home" && <HomeDashboardView health={health!} onGoMap={() => setTab("map")} />}
                {tab === "map" && <FloorplanView onDiagnose={() => setTab("diagnose")} />}
                {tab === "diagnose" && <InferenceView />}
                {tab === "panel" && <PanelView />}
                {tab === "atlas" && <AtlasView />}
                {tab === "prognosis" && <PrognosisView />}
                {tab === "learning" && <LearningView />}
                {tab === "report" && <ReportView />}
                {tab === "ref" && <ReferenceView />}
                {tab === "settings" && <SettingsView />}
              </ErrorBoundary>
            </div>
          </main>

          {/* ── MOBILE DOCK ── */}
          <nav className="botnav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(7,11,18,0.9)", backdropFilter: "blur(12px)", borderTop: `1px solid ${HUD.line}`, display: "none", justifyContent: "space-around", padding: "6px 4px calc(8px + env(safe-area-inset-bottom,0px))", zIndex: 40 }}>
            {TABS.filter((t) => PRIMARY.includes(t.id)).map((t) => (
              <DockBtn key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
            <DockBtn icon="⋯" label="More" active={!PRIMARY.includes(tab)} onClick={() => setMoreOpen(true)} />
          </nav>
        </div>
      )}

      {/* secondary tabs (mobile "More") */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="◆ ALL SECTIONS">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, paddingBottom: 8 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setMoreOpen(false); }} className="oi-press" style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 9, minHeight: 48,
              background: tab === t.id ? `${C.blue}1a` : "#0E1622", border: `1px solid ${tab === t.id ? `${C.blue}66` : HUD.line}`,
              color: tab === t.id ? "#EAF6FF" : C.text, fontFamily: mono, fontSize: 13, fontWeight: 700, textAlign: "left",
            }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </Sheet>

      <LiveDiagnostic open={pip && ready} onClose={() => setPip(false)} />

      <style>{`
        .topnav::-webkit-scrollbar{height:0}
        @media (max-width:760px){
          .topnav{display:none !important}
          .botnav{display:flex !important}
        }
        @media (max-width:430px){
          .hide-narrow{display:none !important}
          .brandfull{font-size:11px !important;letter-spacing:.4px !important}
        }
      `}</style>
    </div>
  );
}

function DockBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="oi-press" style={{
      background: "none", border: "none", color: active ? C.blue : C.dim, fontFamily: mono,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
      minHeight: 48, minWidth: 52, padding: "4px 6px", flex: 1,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1, filter: active ? `drop-shadow(0 0 6px ${C.blue})` : "none" }}>{icon}</span>
      <span style={{ fontSize: active ? 10.5 : 10, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

function CommandTab({ icon, label, active, onClick, reduced }: { icon: string; label: string; active: boolean; onClick: () => void; reduced: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
      aria-current={active ? "page" : undefined} className="oi-press"
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", whiteSpace: "nowrap",
        background: active ? `linear-gradient(180deg,${C.blue}22,${C.blue}0a)` : hover ? "rgba(57,189,248,0.06)" : "transparent",
        border: `1px solid ${active ? `${C.blue}66` : "transparent"}`,
        borderRadius: 8, color: active ? "#EAF6FF" : hover ? C.text : C.dim,
        fontSize: 12, fontWeight: active ? 800 : 500, fontFamily: mono, letterSpacing: 0.6,
        boxShadow: active ? glow(C.blue, 0.35) : "none", transition: "color .15s,background .15s",
      }}
    >
      {active && <Bracket color={C.blue} size={7} inset={2} weight={1.5} opacity={0.9} />}
      <span aria-hidden style={{ fontSize: 13, filter: active ? `drop-shadow(0 0 6px ${C.blue})` : "none" }}>{icon}</span>
      {label}
      {active && <span style={{ position: "absolute", left: 10, right: 10, bottom: -1, height: 2, background: holoGrad, borderRadius: 2, boxShadow: `0 0 8px ${C.blue}` }} />}
    </button>
  );
}

const hudCtl: React.CSSProperties = {
  background: "rgba(57,189,248,0.06)", border: `1px solid ${HUD.line}`, borderRadius: 8,
  padding: "9px 11px", minHeight: 38, fontSize: 9.5, fontFamily: mono, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
};
