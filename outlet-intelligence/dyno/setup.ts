// Vitest setup: IndexedDB shim for the store, matchMedia stub for jsdom.
import "fake-indexeddb/auto";

if (typeof window !== "undefined" && !window.matchMedia) {
  // jsdom has no matchMedia; useReducedMotion guards with ?. but stub anyway.
  window.matchMedia = (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent() { return false; },
  });
}
