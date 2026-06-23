import { useMemo, useState } from 'react';
import type { Player } from '../types';
import { formatCustomStat, formatNumber } from '../lib/format';
import { Pill } from './Row';

interface PlayersListProps {
  players: Player[];
  onSelect: (uuid: string) => void;
}

export default function PlayersList({ players, onSelect }: PlayersListProps) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.uuid.toLowerCase().includes(q))
      .sort((a, b) => b.topMetrics.play_time - a.topMetrics.play_time);
  }, [players, query]);

  return (
    <aside className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md">
      <h2 className="my-1 text-2xl font-semibold">Players</h2>
      <input
        className="bg-[#0c1326] text-text border border-border rounded-xl px-3 py-2.5 font-[inherit] w-full"
        placeholder="Search players…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {matches.length ? (
        matches.map(p => (
          <button
            key={p.uuid}
            type="button"
            onClick={() => onSelect(p.uuid)}
            className="w-full text-left flex justify-between gap-3 py-2.5 border-b border-border/55 hover:bg-accent/10 bg-transparent"
          >
            <span>{p.name}</span>
            <span className="flex gap-2 items-center whitespace-nowrap">
              <Pill>{formatCustomStat('minecraft:play_time', p.topMetrics.play_time)}</Pill>
              <span className="text-muted">{formatNumber(p.topMetrics.mob_kills)} kills</span>
            </span>
          </button>
        ))
      ) : (
        <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted mt-3">
          No players match your search.
        </div>
      )}
    </aside>
  );
}
