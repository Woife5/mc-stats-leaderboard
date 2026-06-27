// Loads all stats on mount, mirroring the original app's load() flow.

import { useEffect, useState } from 'react';
import { listStatsUuids, loadStatsFile, loadUserCache } from '../lib/api';
import { buildCategoryIndex, buildFeatured, buildPlayer } from '../lib/stats';
import type { Board, Category, Player, StatsByCategory } from '../types';

export interface StatsData {
  players: Player[];
  categories: Category[];
  statsByCategory: StatsByCategory;
  featured: Board[];
  playerCount: number;
  loading: boolean;
  error: string | null;
}

const EMPTY: Omit<StatsData, 'loading' | 'error'> = {
  players: [],
  categories: [],
  statsByCategory: {},
  featured: [],
  playerCount: 0,
};

export function useStats(): StatsData {
  const [data, setData] = useState<Omit<StatsData, 'loading' | 'error'>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [uuids, names] = await Promise.all([listStatsUuids(), loadUserCache()]);
      if (cancelled) return;

      if (!uuids.length) {
        setData({ ...EMPTY, playerCount: 0 });
        return;
      }

      const rawFiles = await Promise.all(uuids.map(loadStatsFile));
      if (cancelled) return;

      const players = uuids.map((uuid, i) => buildPlayer(uuid, rawFiles[i], names)).filter((p): p is NonNullable<typeof p> => Boolean(p));

      const { categories, statsByCategory } = buildCategoryIndex(players);
      setData({
        players,
        categories,
        statsByCategory,
        featured: buildFeatured(players),
        playerCount: uuids.length,
      });
    }

    load()
      .catch((err: Error) => {
        if (!cancelled) {
          console.error(err);
          setError(`Failed to load stats: ${err.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading, error };
}
