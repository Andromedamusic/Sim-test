/* ════════════════════════════════════════════════════════════════════════════
   HOME SWITCHER — compact header control for multi-home management.
   Renders a <select> of known homes, inline "New Home" form, inline rename,
   and a guarded delete. All mutations route through the Zustand store.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../../state/store";
import { C, mono, btn } from "../theme";

// ─── tiny shared style helpers (scope-local, no theme pollution) ──────────────
const inputStyle: React.CSSProperties = {
  background: "#0A0A0E",
  border: `1px solid ${C.border}`,
  borderRadius: 7,
  padding: "6px 9px",
  fontSize: 12,
  fontFamily: mono,
  color: C.text,
  minWidth: 0,
  flex: 1,
};

const rowGap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

export function HomeSwitcher(): React.ReactElement {
  const model = useStore((s) => s.model);
  const homes = useStore((s) => s.homes);
  const createHomeAndSwitch = useStore((s) => s.createHomeAndSwitch);
  const switchHome = useStore((s) => s.switchHome);
  const renameCurrentHome = useStore((s) => s.renameCurrentHome);
  const deleteHomeAndSwitch = useStore((s) => s.deleteHomeAndSwitch);

  // ── new-home inline form state ─────────────────────────────────────────────
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  // ── rename inline edit state ───────────────────────────────────────────────
  const [renaming, setRenaming] = useState(false);
  const [renameBuf, setRenameBuf] = useState("");
  const [renameWorking, setRenameWorking] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  // focus helpers
  useEffect(() => {
    if (showNew) newInputRef.current?.focus();
  }, [showNew]);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  if (!model) return <></>;

  const currentId = model.home.id;
  const currentName = model.home.name;

  // ── handlers ──────────────────────────────────────────────────────────────
  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const id = e.target.value;
    if (id !== currentId) void switchHome(id);
  }

  function openNew(): void {
    setShowNew(true);
    setNewName("");
  }

  function cancelNew(): void {
    setShowNew(false);
    setNewName("");
  }

  async function commitNew(): Promise<void> {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createHomeAndSwitch(name);
      setShowNew(false);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  function handleNewKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") void commitNew();
    if (e.key === "Escape") cancelNew();
  }

  function openRename(): void {
    setRenameBuf(currentName);
    setRenaming(true);
  }

  function cancelRename(): void {
    setRenaming(false);
    setRenameBuf("");
  }

  async function commitRename(): Promise<void> {
    const name = renameBuf.trim();
    if (!name || name === currentName) { cancelRename(); return; }
    setRenameWorking(true);
    try {
      await renameCurrentHome(name);
      setRenaming(false);
      setRenameBuf("");
    } finally {
      setRenameWorking(false);
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") void commitRename();
    if (e.key === "Escape") cancelRename();
  }

  async function handleDelete(): Promise<void> {
    const ok = window.confirm(
      `Delete "${currentName}"?\n\nAll floors, rooms, circuits, and outlet readings for this home will be permanently removed. This cannot be undone.\n\n(If this is the last home, a new default home will be created automatically.)`
    );
    if (!ok) return;
    await deleteHomeAndSwitch(currentId);
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 10px",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        minWidth: 0,
        maxWidth: 540,
      }}
    >
      {/* ── row 1: selector + action buttons ─────────────────────────── */}
      <div style={rowGap}>
        {/* home selector */}
        <select
          value={currentId}
          onChange={handleSelectChange}
          aria-label="Active home"
          style={{
            ...inputStyle,
            minWidth: 120,
            maxWidth: 220,
            flex: "1 1 120px",
          }}
        >
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        {/* + New button */}
        {!showNew && (
          <button
            onClick={openNew}
            title="Create a new home"
            style={{
              ...btn(C.good, true),
              padding: "6px 11px",
              fontSize: 11,
              minHeight: 32,
              whiteSpace: "nowrap",
            }}
          >
            + New
          </button>
        )}

        {/* Rename button */}
        {!renaming && (
          <button
            onClick={openRename}
            title={`Rename "${currentName}"`}
            style={{
              ...btn(C.blue, true),
              padding: "6px 11px",
              fontSize: 11,
              minHeight: 32,
              whiteSpace: "nowrap",
            }}
          >
            Rename
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={() => void handleDelete()}
          title={`Delete "${currentName}"`}
          style={{
            ...btn(C.danger, true),
            padding: "6px 11px",
            fontSize: 11,
            minHeight: 32,
            whiteSpace: "nowrap",
          }}
        >
          Delete
        </button>
      </div>

      {/* ── row 2: inline "new home" form (expands on demand) ─────────── */}
      {showNew && (
        <div
          style={{
            ...rowGap,
            background: C.panel2,
            borderRadius: 8,
            padding: "7px 9px",
            border: `1px solid ${C.border}`,
            animation: "oi-fadeup .2s ease both",
          }}
        >
          <span
            style={{
              color: C.dim,
              fontFamily: mono,
              fontSize: 10,
              whiteSpace: "nowrap",
            }}
          >
            New home:
          </span>
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleNewKeyDown}
            placeholder="e.g. 42 Maple St"
            disabled={creating}
            maxLength={80}
            style={{ ...inputStyle, minWidth: 140 }}
            aria-label="New home name"
          />
          <button
            onClick={() => void commitNew()}
            disabled={creating || !newName.trim()}
            style={{
              ...btn(C.good),
              padding: "6px 12px",
              fontSize: 11,
              minHeight: 30,
              opacity: !newName.trim() ? 0.45 : 1,
            }}
          >
            {creating ? "Creating…" : "Create"}
          </button>
          <button
            onClick={cancelNew}
            disabled={creating}
            style={{
              ...btn(C.dimmer, true),
              padding: "6px 10px",
              fontSize: 11,
              minHeight: 30,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── row 3: inline rename form ──────────────────────────────────── */}
      {renaming && (
        <div
          style={{
            ...rowGap,
            background: C.panel2,
            borderRadius: 8,
            padding: "7px 9px",
            border: `1px solid ${C.border}`,
            animation: "oi-fadeup .2s ease both",
          }}
        >
          <span
            style={{
              color: C.dim,
              fontFamily: mono,
              fontSize: 10,
              whiteSpace: "nowrap",
            }}
          >
            Rename:
          </span>
          <input
            ref={renameRef}
            value={renameBuf}
            onChange={(e) => setRenameBuf(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            placeholder="Home name"
            disabled={renameWorking}
            maxLength={80}
            style={{ ...inputStyle, minWidth: 140 }}
            aria-label="Rename home"
          />
          <button
            onClick={() => void commitRename()}
            disabled={renameWorking || !renameBuf.trim() || renameBuf.trim() === currentName}
            style={{
              ...btn(C.blue),
              padding: "6px 12px",
              fontSize: 11,
              minHeight: 30,
              opacity: !renameBuf.trim() || renameBuf.trim() === currentName ? 0.45 : 1,
            }}
          >
            {renameWorking ? "Saving…" : "Save"}
          </button>
          <button
            onClick={cancelRename}
            disabled={renameWorking}
            style={{
              ...btn(C.dimmer, true),
              padding: "6px 10px",
              fontSize: 11,
              minHeight: 30,
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
