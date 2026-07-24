import type { FindingStatus } from "@/lib/types";

interface Props {
  status: FindingStatus;
}

// Small pill mapping status → visual weight + copy. Keeps the states legible
// without another dozen conditionals in the feeds.
export function StatusTag({ status }: Props) {
  if (status === "private")
    return <span className="tag">private</span>;
  if (status === "pending_review")
    return <span className="tag flag">awaiting clinician</span>;
  return <span className="tag accent">reviewed</span>;
}
