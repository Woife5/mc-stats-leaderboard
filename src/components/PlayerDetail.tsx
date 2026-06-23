import { useEffect, useState } from 'react';
import type { Player } from '../types';
import { buildPlayerDetail } from '../lib/stats';
import Row from './Row';

export default function PlayerDetail({ player }: { player: Player | null }) {
  const detail = player ? buildPlayerDetail(player) : null;
  const [activeCategory, setActiveCategory] = useState<string | undefined>(detail?.categories[0]?.category);

  useEffect(() => {
    setActiveCategory(detail?.categories[0]?.category);
  }, [detail?.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!detail) {
    return (
      <section className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md">
        <h2 className="my-1 text-2xl font-semibold">Player details</h2>
        <div className="text-muted">Select a player to inspect stats.</div>
      </section>
    );
  }

  const active = detail.categories.find(c => c.category === activeCategory);

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
          active.topEntries.map(entry => <Row key={entry.stat} name={entry.label} value={entry.displayValue} />)
        ) : (
          <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">
            No stats in this category.
          </div>
        )}
      </div>
    </section>
  );
}
