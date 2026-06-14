/* ════════════════════════════════════════════════════════════════════════════
   CLOUD SYNC — provider-agnostic. The app is offline-first; sync is optional and
   degrades gracefully. Points at any HTTP endpoint that accepts PUT/GET of a
   JSON object per home (S3 pre-signed URL, a tiny server, WebDAV, a Worker, …).
   Last-write-wins by `exportedAt`. No bundled backend; the user configures a URL.
   ════════════════════════════════════════════════════════════════════════════ */
import type { HomeExportDoc } from "../core";

export interface SyncConfig {
  url: string; // base URL; the home id is appended as a filename
  token?: string; // optional bearer token
}

export function syncConfigured(c?: SyncConfig | null): c is SyncConfig {
  return !!c && typeof c.url === "string" && /^https?:\/\//i.test(c.url);
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function endpoint(c: SyncConfig, homeId: string): string {
  return `${c.url.replace(/\/+$/, "")}/outlet-home-${homeId}.json`;
}
function headers(c: SyncConfig): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (c.token) h["authorization"] = `Bearer ${c.token}`;
  return h;
}
async function safeText(r: Response): Promise<string> {
  try { return await r.text(); } catch { return ""; }
}

export async function pushHome(c: SyncConfig, doc: HomeExportDoc): Promise<void> {
  if (!isOnline()) throw new Error("Offline — sync will retry when back online.");
  const res = await fetch(endpoint(c, doc.home.id), {
    method: "PUT", headers: headers(c), body: JSON.stringify(doc),
    signal: AbortSignal.timeout?.(15000),
  });
  if (!res.ok) throw new Error(`Sync push failed (${res.status}): ${await safeText(res)}`);
}

export async function pullHome(c: SyncConfig, homeId: string): Promise<HomeExportDoc | null> {
  if (!isOnline()) throw new Error("Offline — cannot pull.");
  const res = await fetch(endpoint(c, homeId), { headers: headers(c), signal: AbortSignal.timeout?.(15000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Sync pull failed (${res.status})`);
  return (await res.json()) as HomeExportDoc;
}

/** Newer of local vs remote by exportedAt (last-write-wins). */
export function newerDoc(local: HomeExportDoc, remote: HomeExportDoc | null): "local" | "remote" {
  if (!remote) return "local";
  return new Date(remote.exportedAt).getTime() > new Date(local.exportedAt).getTime() ? "remote" : "local";
}
