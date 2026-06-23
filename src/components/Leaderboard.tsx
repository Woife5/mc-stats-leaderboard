import { useMemo } from 'react';
import type { Player } from '../types';
import { buildLeaderboardRows, withDisplay } from '../lib/stats';
import Row from './Row';

interface LeaderboardProps {
  players: Player[];
  category: string;
  stat: string;
}

export default function Leaderboard({ players, category, stat }: LeaderboardProps) {
  const rows = useMemo(
    () => (category && stat ? buildLeaderboardRows(players, category, stat).map(r => withDisplay(r, stat)) : []),
    [players, category, stat],
  );

  let body: React.ReactNode;
  if (!category || !stat) {
    body = <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">Pick a category and stat.</div>;
  } else if (!rows.length) {
    body = <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">No results for this stat.</div>;
  } else {
    body = rows.map(row => <Row key={row.uuid} name={row.name} value={row.displayValue ?? String(row.value)} />);
  }

  return (
    <article className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md">
      <h2 className="my-1 text-2xl font-semibold">Leaderboard</h2>
      <div>{body}</div>
    </article>
  );
}
