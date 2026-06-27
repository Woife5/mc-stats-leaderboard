// Shared domain types for the stats leaderboard.

/** A category -> stat -> value map, e.g. raw["minecraft:custom"]["minecraft:play_time"]. */
export type StatValues = Record<string, number>;
export type StatsByCategoryValues = Record<string, StatValues>;

/** Shape of a raw `<UUID>.json` stats file written by the Minecraft server. */
export interface RawStatsFile {
  stats?: StatsByCategoryValues;
  DataVersion?: number;
}

/** A directory-listing entry as returned by static-web-server's JSON format. */
export interface ListingEntry {
  name: string;
  type: 'file' | 'directory';
  mtime?: string;
  size?: number;
}

export interface TopMetrics {
  play_time: number;
  deaths: number;
  mob_kills: number;
  walk_one_cm: number;
  sprint_one_cm: number;
  aviate_one_cm: number;
}

export interface Player {
  uuid: string;
  name: string;
  stats: StatsByCategoryValues;
  topMetrics: TopMetrics;
}

export interface Category {
  id: string;
  label: string;
}

export type StatsByCategory = Record<string, Set<string>>;

export interface LeaderboardRow {
  uuid: string;
  name: string;
  value: number;
  displayValue?: string;
}

export interface Board {
  title: string;
  rows: LeaderboardRow[];
}

export interface PlayerDetailCategory {
  category: string;
  label: string;
  topEntries: {
    stat: string;
    label: string;
    value: number;
    displayValue: string;
  }[];
}

export interface PlayerDetail {
  uuid: string;
  name: string;
  categories: PlayerDetailCategory[];
}

/** Tooltip details for a stat that increased since the previous snapshot. */
export interface IncreaseDetails {
  previous: string;
  delta: string;
  snapshotAge?: string;
}
