import { useEffect, useMemo, useState } from 'react';
import Controls from './components/Controls';
import FeaturedBoards from './components/FeaturedBoards';
import Leaderboard from './components/Leaderboard';
import PlayerDetail from './components/PlayerDetail';
import PlayersList from './components/PlayersList';
import { useStats } from './hooks/useStats';
import type { Player } from './types';

export default function App() {
  const { players, categories, statsByCategory, featured, playerCount, loading, error } = useStats();

  const [category, setCategory] = useState('');
  const [stat, setStat] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

  // Pick sensible defaults once data arrives: custom category + play_time stat.
  useEffect(() => {
    if (!categories.length) return;
    const defaultCategory = categories.some(c => c.id === 'minecraft:custom') ? 'minecraft:custom' : categories[0].id;
    setCategory(defaultCategory);
  }, [categories]);

  useEffect(() => {
    if (!category) return;
    const stats = [...(statsByCategory[category] || [])].sort();
    if (!stats.length) {
      setStat('');
      return;
    }
    setStat(stats.includes('minecraft:play_time') ? 'minecraft:play_time' : stats[0]);
  }, [category, statsByCategory]);

  const selectedPlayer: Player | null = useMemo(
    () => players.find(p => p.uuid === selectedUuid) ?? null,
    [players, selectedUuid],
  );

  const hasData = !loading && !error && playerCount > 0;
  const noData = !loading && !error && playerCount === 0;

  return (
    <main className="max-w-[1400px] mx-auto p-6">
      <header className="flex justify-between gap-4 items-end mb-[18px] max-[900px]:flex-col max-[900px]:items-start">
        <div>
          <p className="text-muted">Self-hosted Minecraft stats</p>
          <h1 className="my-1 text-4xl font-bold">Leaderboard</h1>
          <p className="text-muted">Browse player stats, leaderboards, and per-player details.</p>
        </div>
        <div className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md">
          <span>Players</span>
          <strong className="block text-2xl">{loading ? '—' : playerCount}</strong>
        </div>
      </header>

      {error && (
        <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">{error}</div>
      )}

      {loading && (
        <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">Loading stats…</div>
      )}

      {noData && (
        <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">
          Bind-mount the server's world stats directory at /public/stats to populate this dashboard.
        </div>
      )}

      {hasData && (
        <>
          <FeaturedBoards boards={featured} />
          <Controls
            categories={categories}
            statsByCategory={statsByCategory}
            category={category}
            stat={stat}
            onCategoryChange={setCategory}
            onStatChange={setStat}
            onReload={() => setReloadKey(k => k + 1)}
          />
          <section className="grid grid-cols-[2fr_1fr] gap-4 max-[900px]:grid-cols-1">
            <Leaderboard key={reloadKey} players={players} category={category} stat={stat} />
            <PlayersList players={players} onSelect={setSelectedUuid} />
          </section>
          <div className="mt-4">
            <PlayerDetail player={selectedPlayer} />
          </div>
        </>
      )}
    </main>
  );
}
