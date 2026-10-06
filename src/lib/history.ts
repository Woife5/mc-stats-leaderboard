// Daily stat history stored in the browser's IndexedDB: one entry per local day.
// Every call fails softly so the app keeps working without history.

import type { Player, StatsByCategoryValues } from '../types';

const DB_NAME = 'mc-stats-leaderboard';
const DB_VERSION = 1;
const STORE = 'daily';
const LEGACY_SNAPSHOT_KEY = 'mc-stats-leaderboard:stats-snapshot:v1';

export interface DailySnapshot {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  savedAt: number;
  players: Record<string, { name: string; stats: StatsByCategoryValues }>;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface GainPoint {
  date: string;
  gain: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD of the browser's local date (not UTC). */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days between two date keys (b - a), independent of DST. */
export function daysBetween(a: string, b: string): number {
  const toDays = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return toDays(b) - toDays(a);
}

let dbPromise: Promise<IDBDatabase> | null = null;
let persistRequested = false;

function requestPersistence(): void {
  if (persistRequested) return;
  persistRequested = true;
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // Persistence is a nice-to-have.
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'date' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let other tabs (or a deleteDatabase call) proceed; reopen lazily next time.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });

  requestPersistence();
  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

interface LegacySnapshot {
  version: 1;
  savedAt: number;
  players: DailySnapshot['players'];
}

function isLegacySnapshot(value: unknown): value is LegacySnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LegacySnapshot>;
  return candidate.version === 1 && !!candidate.players && typeof candidate.players === 'object';
}

/** Move the old single localStorage snapshot into the daily store, once. */
async function migrateLegacySnapshot(db: IDBDatabase): Promise<void> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LEGACY_SNAPSHOT_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (isLegacySnapshot(parsed)) {
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now();
    const entry: DailySnapshot = { date: localDateKey(new Date(savedAt)), savedAt, players: parsed.players };
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const done = txDone(tx);
    const existing = store.get(entry.date);
    existing.onsuccess = () => {
      if (existing.result === undefined) store.add(entry);
    };
    await done;
  }

  window.localStorage.removeItem(LEGACY_SNAPSHOT_KEY);
}

/** All stored days, oldest first. Returns [] when storage is unavailable. */
export async function loadHistory(): Promise<DailySnapshot[]> {
  try {
    const db = await openDb();
    try {
      await migrateLegacySnapshot(db);
    } catch (err) {
      console.warn('Failed to migrate stats snapshot', err);
    }
    const entries = await promisify(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    return (entries as DailySnapshot[]).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  } catch (err) {
    console.warn('Stat history unavailable', err);
    return [];
  }
}

/** Store the current stats as today's entry, replacing any earlier save from today. */
export async function saveToday(players: Player[]): Promise<DailySnapshot> {
  const entry: DailySnapshot = {
    date: localDateKey(),
    savedAt: Date.now(),
    players: Object.fromEntries(players.map(p => [p.uuid, { name: p.name, stats: p.stats }])),
  };

  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const done = txDone(tx);
    tx.objectStore(STORE).put(entry);
    await done;
  } catch (err) {
    console.warn('Failed to save stat history', err);
  }
  return entry;
}

/** Most recent entry strictly before today's local date (today's entry is overwritten on every load). */
export function findPrevious(history: DailySnapshot[], today: string = localDateKey()): DailySnapshot | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].date < today) return history[i];
  }
  return null;
}

export function getPreviousStat(
  previous: DailySnapshot | null,
  uuid: string,
  category: string,
  stat: string,
): number | undefined {
  return previous?.players[uuid]?.stats?.[category]?.[stat];
}

/** One point per day where the player exists and getValue yields a number. */
export function buildSeries(
  history: DailySnapshot[],
  uuid: string,
  getValue: (stats: StatsByCategoryValues | undefined) => number | undefined,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const day of history) {
    const player = day.players[uuid];
    if (!player) continue;
    const value = getValue(player.stats);
    if (typeof value === 'number' && Number.isFinite(value)) points.push({ date: day.date, value });
  }
  return points;
}

/** Increase from the previous point (never negative), starting at the second point. */
export function dailyGains(series: SeriesPoint[]): GainPoint[] {
  return series.slice(1).map((point, i) => ({ date: point.date, gain: Math.max(0, point.value - series[i].value) }));
}
