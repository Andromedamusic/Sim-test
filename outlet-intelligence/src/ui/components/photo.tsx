/* ════════════════════════════════════════════════════════════════════════════
   PHOTO — offline-safe outlet photos: compression helper, capture button,
   and thumbnail strip.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useRef } from "react";
import { useStore } from "../../state/store";
import { C, mono, btn } from "../theme";

// ─── Image compression ────────────────────────────────────────────────────────

/**
 * Load a File into a canvas, downscale so the longest side ≤ maxDim, and
 * export as a JPEG data URL at `quality`. If the first pass is still > 512 KB
 * (e.g., complex photo at q=0.7), a second pass at quality*0.5 is applied.
 * Pure browser; guarded against missing APIs.
 */
export async function compressImage(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.onload = (ev) => {
      const src = ev.target?.result;
      if (typeof src !== "string") { reject(new Error("FileReader returned non-string")); return; }
      const img = new Image();
      img.onerror = () => reject(new Error("Image decode error"));
      img.onload = () => {
        try {
          const { naturalWidth: w, naturalHeight: h } = img;
          const scale = Math.min(1, maxDim / Math.max(w, h, 1));
          const dw = Math.round(w * scale);
          const dh = Math.round(h * scale);
          const canvas = document.createElement("canvas");
          canvas.width = dw;
          canvas.height = dh;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas 2D unavailable")); return; }
          ctx.drawImage(img, 0, 0, dw, dh);
          const first = canvas.toDataURL("image/jpeg", quality);
          // Guard: if still very large (>512 KB base64 ≈ ~384 KB binary), compress once more
          if (first.length > 524_288) {
            const second = canvas.toDataURL("image/jpeg", quality * 0.5);
            resolve(second);
          } else {
            resolve(first);
          }
        } catch (e) {
          reject(e);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Capture button ───────────────────────────────────────────────────────────

export function PhotoCaptureButton({ outletId }: { outletId: string }) {
  const addOutletPhoto = useStore((s) => s.addOutletPhoto);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      await addOutletPhoto(outletId, dataUrl);
    } catch (err) {
      console.error("[photo] compress failed", err);
    } finally {
      // Reset so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        ...btn(C.blue, true),
      }}
      title="Add photo"
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>&#128247;</span>
      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>Add Photo</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </label>
  );
}

// ─── Thumbnail strip ──────────────────────────────────────────────────────────

export function PhotoStrip({ outletId }: { outletId: string }) {
  const outlets = useStore((s) => s.model?.outlets ?? []);
  const removeOutletPhoto = useStore((s) => s.removeOutletPhoto);
  const outlet = outlets.find((o) => o.id === outletId);
  const photos = outlet?.photos ?? [];

  if (!photos.length) {
    return (
      <div style={{ color: C.dim, fontFamily: mono, fontSize: 10, padding: "6px 0" }}>
        No photos yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: "6px 0",
      }}
    >
      {photos.map((photo) => (
        <div
          key={photo.id}
          style={{
            position: "relative",
            width: 72,
            height: 72,
            borderRadius: 8,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          {photo.dataUrl ? (
            <img
              src={photo.dataUrl}
              alt={photo.caption ?? "Outlet photo"}
              title={photo.caption ?? photo.takenAt}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: C.panel2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.dim,
                fontSize: 20,
              }}
            >
              &#128247;
            </div>
          )}
          <button
            onClick={() => removeOutletPhoto(outletId, photo.id)}
            title="Remove photo"
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#0009",
              border: "none",
              color: "#fff",
              fontSize: 10,
              lineHeight: "18px",
              textAlign: "center",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            &#215;
          </button>
        </div>
      ))}
    </div>
  );
}
