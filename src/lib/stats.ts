// Pure domain transforms: build players, category index, leaderboards,
// featured boards, and per-player detail.

import { resolveName } from '../data/resolveName';
import type {
  Board,
  Category,
  LeaderboardRow,
  Player,
  PlayerDetail,
  RawStatsFile,
  StatsByCategory,
  StatsByCategoryValues,
  StatValues,
} from '../types';
import { formatCustomStat, formatNumber, humanize } from './format';

const CATEGORY_LABELS: Record<string, string> = {
  'minecraft:custom': 'Custom',
  'minecraft:mined': 'Mined',
  'minecraft:crafted': 'Crafted',
  'minecraft:used': 'Used',
  'minecraft:broken': 'Broken',
  'minecraft:picked_up': 'Picked up',
  'minecraft:dropped': 'Dropped',
  'minecraft:killed': 'Killed',
  'minecraft:killed_by': 'Killed by',
};

export function buildPlayer(uuid: string, raw: RawStatsFile | null, names: Record<string, string>): Player {
  const stats = raw?.stats || {};
  const custom = stats['minecraft:custom'] || {};
  const killed = stats['minecraft:killed'] || {};
  const topMetrics = {
    play_time: custom['minecraft:play_time'] || 0,
    deaths: custom['minecraft:deaths'] || 0,
    mob_kills: Object.values(killed).reduce((a, b) => a + b, 0),
    walk_one_cm: custom['minecraft:walk_one_cm'] || 0,
    sprint_one_cm: custom['minecraft:sprint_one_cm'] || 0,
    aviate_one_cm: custom['minecraft:aviate_one_cm'] || 0,
  };
  return { uuid, name: resolveName(uuid, names), stats, topMetrics };
}

export function buildCategoryIndex(players: Player[]): {
  categories: Category[];
  statsByCategory: StatsByCategory;
} {
  const statsByCategory: StatsByCategory = {};
  for (const player of players) {
    for (const [category, values] of Object.entries(player.stats || {})) {
      if (!statsByCategory[category]) statsByCategory[category] = new Set();
      for (const stat of Object.keys(values || {})) statsByCategory[category].add(stat);
    }
  }
  const categories = Object.keys(statsByCategory)
    .sort()
    .map(id => ({ id, label: CATEGORY_LABELS[id] || humanize(id) }));
  return { categories, statsByCategory };
}

export function leaderboardRows(players: Player[], category: string, stat: string): LeaderboardRow[] {
  return players
    .map(p => ({ uuid: p.uuid, name: p.name, value: p.stats?.[category]?.[stat] || 0 }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

function withDisplay(row: LeaderboardRow, stat: string): LeaderboardRow {
  return { ...row, displayValue: formatCustomStat(stat, row.value) };
}

export function sumStats(values: StatValues | undefined, filter: (id: string) => boolean = () => true): number {
  return Object.entries(values || {}).reduce((total, [id, value]) => total + (filter(id) ? value : 0), 0);
}

/** Shared context computed once per render and passed to every board's getValue. */
export interface FeaturedContext {
  minedBlockIds: Set<string>;
}

/** A single declarative definition of a featured board, used to compute both
 *  the current value and the previous-snapshot value from the same logic. */
export interface FeaturedBoardDef {
  title: string;
  getValue: (stats: StatsByCategoryValues, ctx: FeaturedContext) => number;
  format: (value: number) => string;
}

/** A board backed by a single `minecraft:custom` stat, formatted per its unit. */
function customBoard(title: string, statId: string): FeaturedBoardDef {
  return {
    title,
    getValue: stats => stats['minecraft:custom']?.[statId] || 0,
    format: value => formatCustomStat(statId, value),
  };
}

/** The featured boards, defined once. buildFeatured and the snapshot
 *  comparison in FeaturedBoards both derive from these descriptors. */
export const FEATURED_BOARDS: FeaturedBoardDef[] = [
  { title: 'Blocks broken', getValue: stats => sumStats(stats['minecraft:mined']), format: formatNumber },
  {
    title: 'Blocks placed',
    getValue: (stats, ctx) => sumStats(stats['minecraft:used'], id => ctx.minedBlockIds.has(id)),
    format: formatNumber,
  },
  { title: 'Mob kills', getValue: stats => sumStats(stats['minecraft:killed']), format: formatNumber },
  customBoard('Damage taken', 'minecraft:damage_taken'),
  customBoard('Deaths', 'minecraft:deaths'),
  customBoard('Walked', 'minecraft:walk_one_cm'),
  customBoard('Sprinted', 'minecraft:sprint_one_cm'),
  customBoard('Distance by boat', 'minecraft:boat_one_cm'),
  customBoard('Flown', 'minecraft:aviate_one_cm'),
  customBoard('Chests opened', 'minecraft:open_chest'),
];

/** Compute the shared context the featured boards need (e.g. the set of block
 *  ids any player has mined, used to filter "blocks placed"). */
export function buildFeaturedContext(players: Player[]): FeaturedContext {
  return {
    minedBlockIds: new Set(players.flatMap(p => Object.keys(p.stats?.['minecraft:mined'] || {}))),
  };
}

export function buildFeatured(players: Player[], limit = 10): Board[] {
  const ctx = buildFeaturedContext(players);
  return FEATURED_BOARDS.map(def => ({
    title: def.title,
    rows: players
      .map(p => ({ uuid: p.uuid, name: p.name, value: def.getValue(p.stats || {}, ctx) }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map(r => ({ ...r, displayValue: def.format(r.value) })),
  }));
}

/** Canonical category order: as defined in CATEGORY_LABELS, unknown categories alphabetically last. */
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function compareCategories(a: string, b: string): number {
  const ia = CATEGORY_ORDER.indexOf(a);
  const ib = CATEGORY_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

export function buildPlayerDetail(player: Player): PlayerDetail {
  const categories = Object.entries(player.stats || {})
    .sort(([a], [b]) => compareCategories(a, b))
    .map(([category, values]) => ({
    category,
    label: CATEGORY_LABELS[category] || humanize(category),
    topEntries: Object.entries(values || {})
      .sort((a, b) => b[1] - a[1])
      .map(([stat, value]) => ({
        stat,
        label: humanize(stat),
        value,
        displayValue: formatCustomStat(stat, value),
      })),
  }));
  return { uuid: player.uuid, name: player.name, categories };
}

export { CATEGORY_LABELS, leaderboardRows as buildLeaderboardRows, withDisplay };
