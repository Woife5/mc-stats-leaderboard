import { useMemo, useState } from 'react';
import { formatDateKey } from '../lib/format';
import { dailyGains, daysBetween, localDateKey, parseDateKey, type SeriesPoint } from '../lib/history';

type Range = '7d' | '30d' | 'all';

const RANGES: { id: Range; label: string; days?: number }[] = [
  { id: '7d', label: '7d', days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: 'all', label: 'All' },
];

const W = 240;
const H = 96;
const PAD_Y = 4;

function filterRange(series: SeriesPoint[], days: number | undefined): SeriesPoint[] {
  if (!days || !series.length) return series;
  const end = parseDateKey(series[series.length - 1].date);
  end.setDate(end.getDate() - days);
  const cutoff = localDateKey(end);
  return series.filter(p => p.date >= cutoff);
}

export default function HistoryChart({
  series,
  format,
}: {
  series: SeriesPoint[];
  format: (value: number) => string;
}) {
  const [range, setRange] = useState<Range>('30d');
  const days = RANGES.find(r => r.id === range)?.days;
  const points = useMemo(() => filterRange(series, days), [series, days]);

  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0].date;
    const last = points[points.length - 1].date;
    const span = Math.max(1, daysBetween(first, last));
    const xOf = (date: string) => (daysBetween(first, date) / span) * W;

    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
    const range = max - min;
    const innerH = H - PAD_Y * 2;
    const yOf = (v: number) => (range === 0 ? H / 2 : PAD_Y + innerH - ((v - min) / range) * innerH);

    const gains = dailyGains(points);
    const maxGain = Math.max(0, ...gains.map(g => g.gain));
    const dayWidth = W / span;
    const barWidth = Math.max(1, Math.min(dayWidth * 0.7, 14));
    const bars = gains.map(g => {
      const h = maxGain > 0 ? (g.gain / maxGain) * (H - PAD_Y) : 0;
      const x = Math.min(W - barWidth, Math.max(0, xOf(g.date) - barWidth / 2));
      return { date: g.date, gain: g.gain, x, y: H - h, w: barWidth, h };
    });

    const line = points.map(p => `${xOf(p.date).toFixed(2)},${yOf(p.value).toFixed(2)}`).join(' ');
    return { first, last, min, max, bars, line };
  }, [points]);

  return (
    <div>
      <div className="mb-2 flex gap-1" role="group" aria-label="History range">
        {RANGES.map(r => (
          <button
            key={r.id}
            type="button"
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
            className={`cursor-pointer rounded-full border border-border px-2 py-0.5 text-xs ${
              range === r.id ? 'bg-accent text-[#08111f]' : 'bg-chip text-text'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {chart ? (
        <>
          <div className="flex gap-2">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block h-24 min-w-0 flex-1 overflow-visible"
              role="img"
              aria-label={`History from ${formatDateKey(chart.first)} to ${formatDateKey(chart.last)}`}
            >
              <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#22304d" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <g className="text-green-400" fill="currentColor" fillOpacity={0.55}>
                {chart.bars.map(b => (
                  <rect key={b.date} x={b.x} y={b.y} width={b.w} height={b.h}>
                    <title>{`${formatDateKey(b.date)}: +${format(b.gain)}`}</title>
                  </rect>
                ))}
              </g>
              <polyline
                points={chart.line}
                fill="none"
                className="text-accent"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="flex flex-col justify-between text-right text-[10px] leading-tight text-muted">
              <span title="Highest total">{format(chart.max)}</span>
              <span title="Lowest total">{format(chart.min)}</span>
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>{formatDateKey(chart.first)}</span>
            <span>{formatDateKey(chart.last)}</span>
          </div>
          <div className="mt-1.5 flex gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-green-400/60" /> Daily gain
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 rounded bg-accent" /> Total
            </span>
          </div>
        </>
      ) : (
        <div className="py-6 text-center text-xs text-muted">Not enough history yet</div>
      )}
    </div>
  );
}
