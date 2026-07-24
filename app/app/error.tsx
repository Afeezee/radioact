"use client";
import { useEffect } from "react";

// Custom error boundary for /app/* so we can actually see what crashed rather
// than the generic "Application error" screen the framework serves.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/app error]", error, error.stack);
  }, [error]);

  return (
    <div className="mx-auto max-w-[720px] px-6 py-14">
      <h1 className="font-display text-2xl mb-2">Something crashed.</h1>
      <p className="text-muted mb-4">
        The error is logged to your browser console.
      </p>
      <pre className="text-xs bg-surface2 border hairline rounded p-3 overflow-x-auto whitespace-pre-wrap">
        {error?.message || String(error)}
        {"\n\n"}
        {error?.stack ?? ""}
      </pre>
      <button className="btn btn-primary mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
