import { NextRequest } from "next/server";
import { subscribeFindings } from "@/lib/stream";
import { hasOntomorph, streamAllSystems } from "@/lib/ontomorph";
import { getAuthContext } from "@/lib/serverAuth";
import type { StoredFinding } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Role-scoped SSE.
//   Patient  → only findings they own (any status).
//   Clinician → only findings in "pending_review" (their queue) or "reviewed"
//               that they reviewed (audit).
//   Unknown / demo → unrestricted, same as before.
// The twin.events.stream() side is included when Ontomorph credentials are set.
export async function GET(req: NextRequest) {
  const { userId, role } = await getAuthContext();
  const encoder = new TextEncoder();

  const shouldSend = (f: StoredFinding): boolean => {
    if (role === "patient") return f.ownerUserId === userId;
    if (role === "clinician")
      return f.status === "pending_review" || (f.status === "reviewed" && f.reviewedBy === userId);
    return true;
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({ type: "hello", ontomorph: hasOntomorph(), role, ts: Date.now() });

      const unsub = subscribeFindings((f: StoredFinding) => {
        if (!shouldSend(f)) return;
        send({ type: "finding", finding: f });
      });

      const twinStream = hasOntomorph()
        ? streamAllSystems((e) => {
            const src = (e.data as any)?.source;
            if (src === "radioact") return;
            send({ type: "twin-event", event: e });
          })
        : { stop: () => {} };

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          /* controller closed */
        }
      }, 15000);

      const close = () => {
        clearInterval(heartbeat);
        unsub();
        twinStream.stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
