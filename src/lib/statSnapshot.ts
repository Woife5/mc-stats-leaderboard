import type { Player, StatsByCategoryValues } from '../types';

const STORAGE_KEY = 'mc-stats-leaderboard:stats-snapshot:v1';

export interface PreviousStatsSnapshot {
  version: 1;
  savedAt: number;
  players: Record<
    string,
    {
      name: string;
      stats: StatsByCategoryValues;
    }
  >;
}

function isSnapshot(value: unknown): value is PreviousStatsSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PreviousStatsSnapshot>;
  return candidate.version === 1 && !!candidate.players && typeof candidate.players === 'object';
}

export function loadPreviousStatsSnapshot(): PreviousStatsSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStatsSnapshot(players: Player[]): void {
  try {
    const snapshot: PreviousStatsSnapshot = {
      version: 1,
      savedAt: Date.now(),
      players: Object.fromEntries(players.map(player => [player.uuid, { name: player.name, stats: player.stats }])),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage may be unavailable or full; comparison indicators are optional.
  }
}

export function getPreviousStat(
  snapshot: PreviousStatsSnapshot | null,
  uuid: string,
  category: string,
  stat: string,
): number | undefined {
  return snapshot?.players[uuid]?.stats?.[category]?.[stat];
}
