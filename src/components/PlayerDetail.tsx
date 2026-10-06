import { useEffect, useMemo, useState } from 'react';
import type { Player } from '../types';
import { formatCustomStat } from '../lib/format';
import { buildSeries, getPreviousStat, type DailySnapshot, type SeriesPoint } from '../lib/history';
import { buildIncrease, describeComparison } from '../lib/increase';
import { buildPlayerDetail } from '../lib/stats';
import Row from './Row';

export default function PlayerDetail({
  player,
  history,
  previous,
}: {
  player: Player | null;
  history: DailySnapshot[];
  previous: DailySnapshot | null;
}) {
  const detail = player ? buildPlayerDetail(player) : null;
  const [activeCategory, setActiveCategory] = useState<string | undefined>(detail?.categories[0]?.category);

  useEffect(() => {
    setActiveCategory(detail?.categories[0]?.category);
  }, [detail?.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = detail?.categories.find(c => c.category === activeCategory);
  const uuid = player?.uuid;

  // Series for the active category only, keyed by stat id.
  const seriesByStat = useMemo((): Map<string, SeriesPoint[]> => {
    if (!uuid || !activeCategory) return new Map();
    const stats = Object.keys(player?.stats[activeCategory] ?? {});
    return new Map(stats.map(stat => [stat, buildSeries(history, uuid, s => s?.[activeCategory]?.[stat])]));
  }, [history, uuid, activeCategory, player]);

  if (!detail) {
    return (
      <section className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md">
        <h2 className="my-1 text-2xl font-semibold">Player details</h2>
        <div className="text-muted">Select a player to inspect stats.</div>
      </section>
    );
  }

  const comparison = describeComparison(previous);

  return (
    <section className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md">
      <h2 className="my-1 text-2xl font-semibold">{detail.name}</h2>
      <div className="text-muted font-mono text-[0.85rem]">{detail.uuid}</div>
      <div className="flex gap-2 flex-wrap my-3">
        {detail.categories.map(c => (
          <button
            key={c.category}
            type="button"
            onClick={() => setActiveCategory(c.category)}
            className={`border border-border rounded-full px-3 py-2 cursor-pointer ${
              c.category === activeCategory ? 'bg-accent text-[#08111f]' : 'bg-chip'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div>
        {active?.topEntries.length ? (
          active.topEntries.map(entry => {
            const previousValue = getPreviousStat(previous, detail.uuid, active.category, entry.stat);
            const format = (v: number) => formatCustomStat(entry.stat, v);
            return (
              <Row
                key={entry.stat}
                name={entry.label}
                value={entry.displayValue}
                increase={buildIncrease(format, entry.value, previousValue, comparison)}
                series={seriesByStat.get(entry.stat)}
                format={format}
              />
            );
          })
        ) : (
          <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">
            No stats in this category.
          </div>
        )}
      </div>
    </section>
  );
}
