import type { Board, Player, StatValues } from '../types';
import type { PreviousStatsSnapshot } from '../lib/statSnapshot';
import { formatCustomStat, formatNumber, formatSnapshotAge } from '../lib/format';
import { getPreviousStat } from '../lib/statSnapshot';
import Row from './Row';

const FEATURED_CUSTOM_STATS: Record<string, string> = {
  Deaths: 'minecraft:deaths',
  Walked: 'minecraft:walk_one_cm',
  Sprinted: 'minecraft:sprint_one_cm',
  'Distance by boat': 'minecraft:boat_one_cm',
  Flown: 'minecraft:aviate_one_cm',
  'Play time': 'minecraft:play_time',
};

function sumStats(values: StatValues | undefined, filter: (id: string) => boolean = () => true): number {
  return Object.entries(values || {}).reduce((total, [id, value]) => total + (filter(id) ? value : 0), 0);
}

function previousFeaturedValue(
  snapshot: PreviousStatsSnapshot | null,
  minedBlockIds: Set<string>,
  boardTitle: string,
  uuid: string,
): { value: number; displayValue: string } | undefined {
  const player = snapshot?.players[uuid];
  if (!player) return undefined;

  if (boardTitle === 'Blocks broken') {
    const value = sumStats(player.stats['minecraft:mined']);
    return { value, displayValue: formatNumber(value) };
  }

  if (boardTitle === 'Blocks placed') {
    const value = sumStats(player.stats['minecraft:used'], id => minedBlockIds.has(id));
    return { value, displayValue: formatNumber(value) };
  }

  if (boardTitle === 'Mob kills') {
    const value = sumStats(player.stats['minecraft:killed']);
    return { value, displayValue: formatNumber(value) };
  }

  const customStat = FEATURED_CUSTOM_STATS[boardTitle];
  if (!customStat) return undefined;

  const value = getPreviousStat(snapshot, uuid, 'minecraft:custom', customStat);
  return value === undefined ? undefined : { value, displayValue: formatCustomStat(customStat, value) };
}

function previousFeaturedValueFromDelta(boardTitle: string, delta: number): string {
  const customStat = FEATURED_CUSTOM_STATS[boardTitle];
  return customStat ? formatCustomStat(customStat, delta) : formatNumber(delta);
}

export default function FeaturedBoards({
  boards,
  players,
  previousSnapshot,
}: {
  boards: Board[];
  players: Player[];
  previousSnapshot: PreviousStatsSnapshot | null;
}) {
  const minedBlockIds = new Set(players.flatMap(player => Object.keys(player.stats?.['minecraft:mined'] || {})));
  const snapshotAge = previousSnapshot ? formatSnapshotAge(previousSnapshot.savedAt) : undefined;

  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-4">
      {boards.map(board => (
        <div key={board.title} className="p-3.5 rounded-2xl bg-panel border border-border">
          <h3 className="my-1 text-lg font-semibold">{board.title}</h3>
          {board.rows.length ? (
            board.rows
              .slice(0, 5)
              .map(row => {
                const previous = previousFeaturedValue(previousSnapshot, minedBlockIds, board.title, row.uuid);
                const increased = previous && row.value > previous.value;
                return (
                  <Row
                    key={row.uuid}
                    name={row.name}
                    value={row.displayValue ?? String(row.value)}
                    increase={
                      increased
                        ? {
                            previous: previous.displayValue,
                            delta: `+${previousFeaturedValueFromDelta(board.title, row.value - previous.value)}`,
                            snapshotAge,
                          }
                        : undefined
                    }
                  />
                );
              })
          ) : (
            <div className="p-[18px] border border-dashed border-border rounded-2xl text-muted">
              No stats available.
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
