import type { ReactNode } from 'react';

export interface IncreaseDetails {
  previous: string;
  delta: string;
  snapshotAge?: string;
}

export default function StatBubble({ children, increase }: { children: ReactNode; increase?: IncreaseDetails }) {
  const summary = increase ? `${increase.delta} since last refresh` : undefined;

  return (
    <span className="relative group inline-flex items-center rounded-full bg-chip px-2 py-0.5 text-[#cfe0ff]">
      {children}
      {increase ? (
        <>
          <span className="ml-1 text-green-400" aria-label={`Increased by ${increase.delta} since last refresh`}>
            ↑
          </span>
          <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden min-w-max rounded-lg border border-border bg-[#0c1326] px-2 py-1 text-xs text-text shadow-lg group-hover:block">
            <span className="block font-semibold text-green-300">{summary}</span>
            <span className="block text-muted">Previous: {increase.previous}</span>
            {increase.snapshotAge ? <span className="block text-muted">Refreshed: {increase.snapshotAge}</span> : null}
          </span>
        </>
      ) : null}
    </span>
  );
}
