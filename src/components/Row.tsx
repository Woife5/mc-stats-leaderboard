interface RowProps {
  name: string;
  value: string;
}

const ROW_CLASS = 'flex justify-between gap-3 py-2.5 border-b border-border/55';

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="bg-chip px-2 py-0.5 rounded-full text-[#cfe0ff]">{children}</span>;
}

export default function Row({ name, value }: RowProps) {
  return (
    <div className={ROW_CLASS}>
      <span>{name}</span>
      <Pill>{value}</Pill>
    </div>
  );
}

export { ROW_CLASS };
