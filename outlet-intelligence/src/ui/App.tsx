import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { rollupHome } from "../core";
import { C, mono, GRADE_COLOR } from "./theme";
import { Pill } from "./components";
import { MotionStyles } from "./anim";
import { InferenceView } from "./views/InferenceView";
import { FloorplanView } from "./views/FloorplanView";
import { HomeDashboardView } from "./views/HomeDashboardView";
import { AtlasView } from "./views/AtlasView";
import { PrognosisView } from "./views/PrognosisView";
import { ReferenceView } from "./views/ReferenceView";
import { SettingsView } from "./views/SettingsView";
import { PanelView } from "./views/PanelView";
import { LearningView } from "./views/LearningView";

type TabId = "home" | "map" | "diagnose" | "panel" | "atlas" | "prognosis" | "learning" | "ref" | "settings";
const PRIMARY: TabId[] = ["home", "map", "diagnose", "panel", "settings"];
const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "map", label: "Map", icon: "🗺️" },
  { id: "diagnose", label: "Diagnose", icon: "🧠" },
  { id: "panel", label: "Panel", icon: "🔌" },
  { id: "atlas", label: "Atlas", icon: "📚" },
  { id: "prognosis", label: "Prognosis", icon: "📉" },
  { id: "learning", label: "Learning", icon: "🎓" },
  { id: "ref", label: "Reference", icon: "📖" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export function App() {
  const { ready, init, model, rev } = useStore();
  const [tab, setTab] = useState<TabId>("home");
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const health = useMemo(() => (model ? rollupHome(model) : null), [model, rev]);

  if (!ready || !model) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh", color: C.dim, fontFamily: mono }}>⚡ Loading Outlet Intelligence…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 64 }}>
      <MotionStyles />
      {/* header */}
      <header style={{ background: "#0F0F12", borderBottom: `1px solid ${C.border}`, padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 20 }}>
        <span style={{ color: C.amber, fontFamily: mono, fontWeight: 800, fontSize: 14 }}>⚡ OUTLET&nbsp;INTELLIGENCE</span>
        <span style={{ color: C.dimmer, fontSize: 10, fontFamily: mono }}>{model.home.name}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {health && <Pill color={GRADE_COLOR[health.grade]}>{health.safetyHold ? "⚠ SAFETY HOLD" : health.grade}</Pill>}
          <span title={online ? "online" : "offline — engine fully functional"} style={{ fontSize: 10, fontFamily: mono, color: online ? C.good : C.dim }}>{online ? "● online" : "○ offline"}</span>
        </div>
      </header>

      {/* desktop tabs */}
      <nav className="topnav" style={{ display: "flex", gap: 4, padding: "6px 10px", background: "#0F0F12", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main style={{ flex: 1, maxWidth: 1280, width: "100%", margin: "0 auto", padding: 12 }}>
        {tab === "home" && <HomeDashboardView health={health!} onGoMap={() => setTab("map")} />}
        {tab === "map" && <FloorplanView onDiagnose={() => setTab("diagnose")} />}
        {tab === "diagnose" && <InferenceView />}
        {tab === "panel" && <PanelView />}
        {tab === "atlas" && <AtlasView />}
        {tab === "prognosis" && <PrognosisView />}
        {tab === "learning" && <LearningView />}
        {tab === "ref" && <ReferenceView />}
        {tab === "settings" && <SettingsView />}
      </main>

      {/* mobile bottom nav */}
      <nav className="botnav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0F0F12ee", backdropFilter: "blur(8px)", borderTop: `1px solid ${C.border}`, display: "none", justifyContent: "space-around", padding: "6px 4px 8px", zIndex: 30 }}>
        {TABS.filter((t) => PRIMARY.includes(t.id)).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", color: tab === t.id ? C.amber : C.dim, fontSize: 10, fontFamily: mono, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "2px 6px" }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <style>{`
        .topnav::-webkit-scrollbar { height: 0; }
        @media (max-width: 720px) {
          .botnav { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", whiteSpace: "nowrap",
    background: active ? "#1E293B" : "transparent", border: `1px solid ${active ? C.blue : "transparent"}`,
    borderRadius: 8, color: active ? C.text : C.dim, fontSize: 12, fontWeight: active ? 700 : 400, fontFamily: mono,
  };
}
