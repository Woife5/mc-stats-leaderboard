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

function sumStats(values: StatValues | undefined, filter: (id: string) => boolean = () => true): number {
  return Object.entries(values || {}).reduce((total, [id, value]) => total + (filter(id) ? value : 0), 0);
}

function topBoard(players: Player[], title: string, category: string, stat: string, limit = 10): Board {
  return {
    title,
    rows: leaderboardRows(players, category, stat)
      .slice(0, limit)
      .map(r => withDisplay(r, stat)),
  };
}

function totalBoard(players: Player[], title: string, getValue: (p: Player) => number, limit = 10): Board {
  return {
    title,
    rows: players
      .map(p => ({ uuid: p.uuid, name: p.name, value: getValue(p) }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map(r => ({ ...r, displayValue: formatNumber(r.value) })),
  };
}

export function buildFeatured(players: Player[]): Board[] {
  const minedBlockIds = new Set(players.flatMap(p => Object.keys(p.stats?.['minecraft:mined'] || {})));
  const mobKillRows = players
    .map(p => ({
      uuid: p.uuid,
      name: p.name,
      value: Object.values(p.stats?.['minecraft:killed'] || {}).reduce((a, b) => a + b, 0),
    }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map(r => ({ ...r, displayValue: formatNumber(r.value) }));
  return [
    totalBoard(players, 'Blocks broken', p => sumStats(p.stats?.['minecraft:mined'])),
    totalBoard(players, 'Blocks placed', p => sumStats(p.stats?.['minecraft:used'], id => minedBlockIds.has(id))),
    { title: 'Mob kills', rows: mobKillRows },
    topBoard(players, 'Damage taken', 'minecraft:custom', 'minecraft:damage_taken'),
    topBoard(players, 'Deaths', 'minecraft:custom', 'minecraft:deaths'),
    topBoard(players, 'Walked', 'minecraft:custom', 'minecraft:walk_one_cm'),
    topBoard(players, 'Sprinted', 'minecraft:custom', 'minecraft:sprint_one_cm'),
    topBoard(players, 'Distance by boat', 'minecraft:custom', 'minecraft:boat_one_cm'),
    topBoard(players, 'Flown', 'minecraft:custom', 'minecraft:aviate_one_cm'),
    topBoard(players, 'Chests opened', 'minecraft:custom', 'minecraft:open_chest'),
  ];
}

export function buildPlayerDetail(player: Player): PlayerDetail {
  const categories = Object.entries(player.stats || {}).map(([category, values]) => ({
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
