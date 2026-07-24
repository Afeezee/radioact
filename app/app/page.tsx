import { Reader } from "@/components/Reader";
import { RequireAuth } from "@/components/RequireAuth";
import { TRIAGE_DISCLAIMER } from "@/lib/prompt";

// Patient-only route: upload a scan, read the AI triage, hand it to a clinician.
export default function AppReaderPage() {
  return (
    <RequireAuth requiredRole="patient">
      <div>
        <section className="border-b hairline">
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl md:text-4xl tracking-tight">
                  Your scan, read for you first.
                </h1>
                <p className="text-muted mt-1 max-w-2xl">
                  Upload a chest X-ray, limb X-ray, or CT slice. You'll see the
                  AI's read privately, and can send it to a clinician for expert
                  review when you're ready.
                </p>
              </div>
              <p className="text-xs text-muted md:text-right md:max-w-xs">
                {TRIAGE_DISCLAIMER}
              </p>
            </div>
          </div>
        </section>
        <Reader />
      </div>
    </RequireAuth>
  );
}
