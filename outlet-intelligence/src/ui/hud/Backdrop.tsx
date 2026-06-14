/* ════════════════════════════════════════════════════════════════════════════
   BACKDROP — cinematic command-center atmosphere behind the whole app.
   Canvas: drifting starfield + a slow rotating "halo" ring arc + a perspective
   floor grid, with pointer parallax. CSS overlay adds scanlines + vignette.
   Fixed, pointer-events:none, GPU-light, honours prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useRef } from "react";

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const parallax = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const canvas = ref.current!;
    let ctx0: CanvasRenderingContext2D | null = null;
    try { ctx0 = canvas.getContext("2d"); } catch { ctx0 = null; }
    if (!ctx0) return; // no 2D canvas (jsdom / headless) — backdrop simply no-ops
    const ctx = ctx0; // const, non-null for the animation closure
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let raf = 0, t = 0;
    let W = 0, H = 0, DPR = 1;
    let stars: { x: number; y: number; z: number; r: number; tw: number }[] = [];

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.min(150, Math.floor((W * H) / 11000));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        z: 0.3 + Math.random() * 0.7, r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => {
      parallax.current.tx = (e.clientX / window.innerWidth - 0.5);
      parallax.current.ty = (e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove);

    const draw = () => {
      t += 1;
      const p = parallax.current;
      p.x += (p.tx - p.x) * 0.04; p.y += (p.ty - p.y) * 0.04;
      ctx.clearRect(0, 0, W, H);

      // deep radial wash
      const g = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, Math.max(W, H) * 0.85);
      g.addColorStop(0, "#0b1626");
      g.addColorStop(0.5, "#070b14");
      g.addColorStop(1, "#04060b");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // halo ring — a vast faint arc near the top, slowly rotating
      const cx = W * 0.5 + p.x * 60;
      const cy = H * (H > W ? 0.16 : 0.05) + p.y * 30;
      const R = Math.max(W, H) * 0.72;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((reduce ? 0 : t * 0.00018) - 0.18);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, R - i * 7, Math.PI * 0.06, Math.PI * 0.94);
        ctx.strokeStyle = `rgba(57,189,248,${0.05 - i * 0.012})`;
        ctx.lineWidth = i === 0 ? 2.2 : 1;
        ctx.stroke();
      }
      // inner band texture
      ctx.beginPath();
      ctx.arc(0, 0, R - 26, Math.PI * 0.12, Math.PI * 0.88);
      ctx.strokeStyle = "rgba(129,140,248,0.05)";
      ctx.lineWidth = 30;
      ctx.stroke();
      ctx.restore();

      // starfield
      for (const s of stars) {
        const twk = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * 0.03 + s.tw);
        const sx = s.x + p.x * 40 * s.z;
        const sy = s.y + p.y * 40 * s.z + (reduce ? 0 : t * 0.04 * s.z);
        const yy = ((sy % (H + 20)) + H + 20) % (H + 20);
        ctx.beginPath();
        ctx.arc(sx, yy, s.r * s.z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${180 + s.z * 60},${210 + s.z * 30},255,${0.5 * twk * s.z})`;
        ctx.fill();
      }

      // perspective floor grid (bottom)
      ctx.save();
      ctx.strokeStyle = "rgba(57,189,248,0.06)";
      ctx.lineWidth = 1;
      const horizon = H * 0.74;
      const scroll = reduce ? 0 : (t * 0.5) % 46;
      for (let i = 0; i < 16; i++) {
        const yy = horizon + i * 46 - scroll;
        if (yy < horizon || yy > H + 4) continue;
        const a = (yy - horizon) / (H - horizon);
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const vanish = W * 0.5 + p.x * 80;
      for (let i = -10; i <= 10; i++) {
        ctx.globalAlpha = 0.18 - Math.abs(i) * 0.012;
        ctx.beginPath(); ctx.moveTo(vanish + i * 26, horizon); ctx.lineTo(vanish + i * 150, H); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", onMove); };
  }, []);

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
      {/* scanlines + vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,0.16) 3px,rgba(0,0,0,0) 4px)",
        mixBlendMode: "overlay", opacity: 0.5,
      }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 240px 40px #04060b", background: "radial-gradient(120% 80% at 50% 30%, transparent 55%, #04060bcc 100%)" }} />
    </div>
  );
}
