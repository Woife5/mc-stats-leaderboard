import type { Board, Player } from '../types';
import type { PreviousStatsSnapshot } from '../lib/statSnapshot';
import { formatSnapshotAge } from '../lib/format';
import { buildIncrease } from '../lib/increase';
import { buildFeaturedContext, FEATURED_BOARDS } from '../lib/stats';
import Row from './Row';

const DEFS_BY_TITLE = new Map(FEATURED_BOARDS.map(def => [def.title, def]));

export default function FeaturedBoards({
  boards,
  players,
  previousSnapshot,
}: {
  boards: Board[];
  players: Player[];
  previousSnapshot: PreviousStatsSnapshot | null;
}) {
  const ctx = buildFeaturedContext(players);
  const snapshotAge = previousSnapshot ? formatSnapshotAge(previousSnapshot.savedAt) : undefined;

  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-4">
      {boards.map(board => {
        const def = DEFS_BY_TITLE.get(board.title);
        return (
          <div key={board.title} className="p-3.5 rounded-2xl bg-panel border border-border">
            <h3 className="my-1 text-lg font-semibold">{board.title}</h3>
            {board.rows.length ? (
              board.rows.slice(0, 5).map(row => {
                const previousPlayer = previousSnapshot?.players[row.uuid];
                const previousValue =
                  def && previousPlayer ? def.getValue(previousPlayer.stats, ctx) : undefined;
                return (
                  <Row
                    key={row.uuid}
                    name={row.name}
                    value={row.displayValue ?? String(row.value)}
                    increase={
                      def ? buildIncrease(def.format, row.value, previousValue, snapshotAge) : undefined
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
        );
      })}
    </section>
  );
}
