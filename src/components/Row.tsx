interface RowProps {
  name: string;
  value: string;
  increase?: IncreaseDetails;
}

export interface IncreaseDetails {
  previous: string;
  delta: string;
  snapshotAge?: string;
}

const ROW_CLASS = 'flex justify-between gap-3 py-2.5 border-b border-border/55';

export function IncreaseIndicator({ increase }: { increase: IncreaseDetails }) {
  const summary = `${increase.delta} since last refresh`;

  return (
    <span className="relative inline-flex group ml-1 text-green-400">
      <span aria-label={`Increased by ${increase.delta} since last refresh`}>↑</span>
      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden min-w-max rounded-lg border border-border bg-[#0c1326] px-2 py-1 text-xs text-text shadow-lg group-hover:block group-focus-within:block">
        <span className="block font-semibold text-green-300">{summary}</span>
        <span className="block text-muted">Previous: {increase.previous}</span>
        {increase.snapshotAge ? <span className="block text-muted">Refreshed: {increase.snapshotAge}</span> : null}
      </span>
    </span>
  );
}

export function Pill({ children, increase }: { children: React.ReactNode; increase?: IncreaseDetails }) {
  return (
    <span className="bg-chip px-2 py-0.5 rounded-full text-[#cfe0ff]">
      {children}
      {increase ? <IncreaseIndicator increase={increase} /> : null}
    </span>
  );
}

export default function Row({ name, value, increase }: RowProps) {
  return (
    <div className={ROW_CLASS}>
      <span>{name}</span>
      <Pill increase={increase}>{value}</Pill>
    </div>
  );
}

export { ROW_CLASS };
