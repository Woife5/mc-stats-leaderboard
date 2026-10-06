import { useMemo, useState } from 'react';
import type { Player } from '../types';
import { formatCustomStat } from '../lib/format';
import { buildSeries, getPreviousStat, type DailySnapshot } from '../lib/history';
import { buildIncrease, describeComparison } from '../lib/increase';
import StatBubble from './StatBubble';

interface PlayersListProps {
  players: Player[];
  history: DailySnapshot[];
  previous: DailySnapshot | null;
  onSelect: (uuid: string) => void;
}

const formatPlayTime = (v: number) => formatCustomStat('minecraft:play_time', v);

export default function PlayersList({ players, history, previous, onSelect }: PlayersListProps) {
  const [query, setQuery] = useState('');
  const comparison = describeComparison(previous);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.uuid.toLowerCase().includes(q))
      .sort((a, b) => b.topMetrics.play_time - a.topMetrics.play_time);
  }, [players, query]);

  const seriesByUuid = useMemo(
    () =>
      new Map(
        players.map(p => [p.uuid, buildSeries(history, p.uuid, s => s?.['minecraft:custom']?.['minecraft:play_time'])]),
      ),
    [players, history],
  );

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
        matches.map(p => {
          const previousPlayTime = getPreviousStat(previous, p.uuid, 'minecraft:custom', 'minecraft:play_time');

          // A div rather than a button so the sparkline button inside stays valid HTML;
          // the name button keeps the row reachable by keyboard.
          return (
            <div
              key={p.uuid}
              onClick={() => onSelect(p.uuid)}
              className="w-full text-left flex justify-between items-center gap-3 cursor-pointer p-2.5 border-b border-border/55 hover:bg-accent/10 bg-transparent"
            >
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onSelect(p.uuid);
                }}
                className="cursor-pointer bg-transparent p-0 text-left text-inherit"
              >
                {p.name}
              </button>
              <span className="flex gap-2 items-center whitespace-nowrap">
                <StatBubble
                  increase={buildIncrease(formatPlayTime, p.topMetrics.play_time, previousPlayTime, comparison)}
                  series={seriesByUuid.get(p.uuid)}
                  format={formatPlayTime}
                  label={`${p.name} – play time`}
                >
                  {formatPlayTime(p.topMetrics.play_time)}
                </StatBubble>
              </span>
            </div>
          );
        })
      ) : (
        <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted mt-3">
          No players match your search.
        </div>
      )}
    </aside>
  );
}
