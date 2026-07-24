// A tiny in-process pub/sub so /api/analyze can push new findings straight
// into the /api/stream SSE loop the /clinic dashboard subscribes to. This is
// separate from twin.events.stream() (which polls the platform) and is what
// gives the demo an instant, in-tab live feed.

import type { StoredFinding } from "./types";

type Listener = (f: StoredFinding) => void;

const g = globalThis as unknown as { __radioactBus?: Set<Listener> };
if (!g.__radioactBus) g.__radioactBus = new Set<Listener>();
const bus = g.__radioactBus;

export function publishFinding(f: StoredFinding) {
  for (const l of bus) {
    try {
      l(f);
    } catch (e) {
      console.error("[bus] listener threw", e);
    }
  }
}

export function subscribeFindings(l: Listener): () => void {
  bus.add(l);
  return () => {
    bus.delete(l);
  };
}
