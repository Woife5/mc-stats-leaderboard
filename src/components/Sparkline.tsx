import { daysBetween, type SeriesPoint } from '../lib/history';

const WIDTH = 48;
const HEIGHT = 16;
const PAD = 1.5;

/** polyline points with x placed by real date and y scaled min..max (flat series sit in the middle). */
export function sparklinePoints(series: SeriesPoint[], width = WIDTH, height = HEIGHT, pad = PAD): string {
  if (series.length < 2) return '';
  const first = series[0].date;
  const span = Math.max(1, daysBetween(first, series[series.length - 1].date));
  let min = Infinity;
  let max = -Infinity;
  for (const p of series) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  }
  const range = max - min;
  const innerH = height - pad * 2;

  return series
    .map(p => {
      const x = (daysBetween(first, p.date) / span) * width;
      const y = range === 0 ? height / 2 : pad + innerH - ((p.value - min) / range) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function Sparkline({ series, className = 'block h-4 w-full' }: { series: SeriesPoint[]; className?: string }) {
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`${className} overflow-visible`}
    >
      <polyline
        points={sparklinePoints(series)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
