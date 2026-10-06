// Loads the daily stat history from IndexedDB and stores today's stats once they arrive.

import { useEffect, useMemo, useState } from 'react';
import { findPrevious, loadHistory, localDateKey, saveToday, type DailySnapshot } from '../lib/history';
import type { Player } from '../types';

export interface StatHistory {
  /** All stored days, oldest first, including today. */
  history: DailySnapshot[];
  /** Most recent day before today, used for the increase indicators. */
  previous: DailySnapshot | null;
}

export function useStatHistory(players: Player[], hasData: boolean): StatHistory {
  const [stored, setStored] = useState<DailySnapshot[]>([]);
  const [today, setToday] = useState<DailySnapshot | null>(null);
  const [todayKey] = useState(() => localDateKey());

  useEffect(() => {
    let cancelled = false;
    loadHistory().then(entries => {
      if (!cancelled) setStored(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasData) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      saveToday(players).then(entry => {
        if (!cancelled) setToday(entry);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [hasData, players]);

  const history = useMemo(() => {
    if (!today) return stored;
    // Replace (or append) today's entry so its point shows up straight away.
    return [...stored.filter(e => e.date !== today.date), today].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
  }, [stored, today]);

  const previous = useMemo(() => findPrevious(stored, todayKey), [stored, todayKey]);

  return { history, previous };
}
