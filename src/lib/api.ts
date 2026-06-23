// Network helpers. Runtime behavior matches the original static app:
// fetch the /stats/ JSON directory listing, then each <uuid>.json file.
// All requests append a ?t=<timestamp> cache-buster so the static server's
// default Cache-Control headers don't get in the way.

import type { ListingEntry, RawStatsFile } from '../types';

export const STATS_PATH = '/stats/';

function cacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(cacheBust(url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed for ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function listStatsUuids(): Promise<string[]> {
  const listing = await getJson<ListingEntry[]>(STATS_PATH);
  if (!Array.isArray(listing)) return [];
  return listing
    .filter(entry => entry?.type === 'file' && entry.name?.endsWith('.json'))
    .map(entry => entry.name.replace(/\.json$/, ''));
}

export async function loadStatsFile(uuid: string): Promise<RawStatsFile | null> {
  try {
    return await getJson<RawStatsFile>(`${STATS_PATH}${encodeURIComponent(uuid)}.json`);
  } catch (err) {
    console.warn(`Failed to load ${uuid}: ${(err as Error).message}`);
    return null;
  }
}
