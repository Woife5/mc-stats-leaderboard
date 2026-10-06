import type { SeriesPoint } from '../lib/history';
import type { IncreaseDetails } from '../types';
import StatBubble from './StatBubble';

interface RowProps {
  name: string;
  value: string;
  increase?: IncreaseDetails;
  series?: SeriesPoint[];
  format?: (value: number) => string;
}

const ROW_CLASS = 'flex justify-between gap-3 py-2.5 border-b border-border/55';

export default function Row({ name, value, increase, series, format }: RowProps) {
  return (
    <div className={ROW_CLASS}>
      <span>{name}</span>
      <StatBubble increase={increase} series={series} format={format} label={name}>
        {value}
      </StatBubble>
    </div>
  );
}

export { ROW_CLASS };
