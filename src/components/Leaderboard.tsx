import { useMemo } from 'react';
import type { Player } from '../types';
import { buildLeaderboardRows, withDisplay } from '../lib/stats';
import { formatCustomStat } from '../lib/format';
import { buildSeries, getPreviousStat, type DailySnapshot } from '../lib/history';
import { buildIncrease, describeComparison } from '../lib/increase';
import Row from './Row';

interface LeaderboardProps {
  players: Player[];
  category: string;
  stat: string;
  history: DailySnapshot[];
  previous: DailySnapshot | null;
}

export default function Leaderboard({ players, category, stat, history, previous }: LeaderboardProps) {
  const rows = useMemo(
    () => (category && stat ? buildLeaderboardRows(players, category, stat).map(r => withDisplay(r, stat)) : []),
    [players, category, stat],
  );

  const seriesByUuid = useMemo(
    () => new Map(rows.map(row => [row.uuid, buildSeries(history, row.uuid, s => s?.[category]?.[stat])])),
    [history, rows, category, stat],
  );

  const format = useMemo(() => (v: number) => formatCustomStat(stat, v), [stat]);

  let body: React.ReactNode;
  if (!category || !stat) {
    body = <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">Pick a category and stat.</div>;
  } else if (!rows.length) {
    body = <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">No results for this stat.</div>;
  } else {
    const comparison = describeComparison(previous);

    body = rows.map(row => {
      const previousValue = getPreviousStat(previous, row.uuid, category, stat);
      return (
        <Row
          key={row.uuid}
          name={row.name}
          value={row.displayValue ?? String(row.value)}
          increase={buildIncrease(format, row.value, previousValue, comparison)}
          series={seriesByUuid.get(row.uuid)}
          format={format}
        />
      );
    });
  }

  return (
    <article className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md">
      <h2 className="my-1 text-2xl font-semibold">Leaderboard</h2>
      <div>{body}</div>
    </article>
  );
}
