import { Clinic } from "@/components/Clinic";
import { TRIAGE_DISCLAIMER } from "@/lib/prompt";

export default function ClinicPage() {
  return (
    <div>
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1400px] px-6 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl md:text-4xl tracking-tight">
              Clinic feed
            </h1>
            <p className="text-muted mt-1 max-w-2xl">
              Live view of RadioAct findings and any other events landing on
              your granted twins, streamed via <code>twin.events.stream()</code>{" "}
              per body system. Sorted by severity within the day.
            </p>
          </div>
          <p className="text-xs text-muted md:text-right md:max-w-xs">
            {TRIAGE_DISCLAIMER}
          </p>
        </div>
      </section>
      <Clinic />
    </div>
  );
}
