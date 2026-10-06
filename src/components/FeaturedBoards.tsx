import { useMemo } from 'react';
import type { Board, Player } from '../types';
import { buildSeries, type DailySnapshot, type SeriesPoint } from '../lib/history';
import { buildIncrease, describeComparison } from '../lib/increase';
import { buildFeaturedContext, FEATURED_BOARDS } from '../lib/stats';
import Row from './Row';

const DEFS_BY_TITLE = new Map(FEATURED_BOARDS.map(def => [def.title, def]));
const VISIBLE_ROWS = 5;

export default function FeaturedBoards({
  boards,
  players,
  history,
  previous,
}: {
  boards: Board[];
  players: Player[];
  history: DailySnapshot[];
  previous: DailySnapshot | null;
}) {
  const ctx = useMemo(() => buildFeaturedContext(players), [players]);
  const comparison = describeComparison(previous);

  // Keyed by board title, then player uuid.
  const seriesByBoard = useMemo(() => {
    const result = new Map<string, Map<string, SeriesPoint[]>>();
    for (const board of boards) {
      const def = DEFS_BY_TITLE.get(board.title);
      if (!def) continue;
      result.set(
        board.title,
        new Map(
          board.rows
            .slice(0, VISIBLE_ROWS)
            .map(row => [row.uuid, buildSeries(history, row.uuid, s => (s ? def.getValue(s, ctx) : undefined))]),
        ),
      );
    }
    return result;
  }, [boards, history, ctx]);

  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-4">
      {boards.map(board => {
        const def = DEFS_BY_TITLE.get(board.title);
        return (
          <div key={board.title} className="p-3.5 rounded-2xl bg-panel border border-border">
            <h3 className="my-1 text-lg font-semibold">{board.title}</h3>
            {board.rows.length ? (
              board.rows.slice(0, VISIBLE_ROWS).map(row => {
                const previousPlayer = previous?.players[row.uuid];
                const previousValue =
                  def && previousPlayer ? def.getValue(previousPlayer.stats, ctx) : undefined;
                return (
                  <Row
                    key={row.uuid}
                    name={row.name}
                    value={row.displayValue ?? String(row.value)}
                    increase={
                      def ? buildIncrease(def.format, row.value, previousValue, comparison) : undefined
                    }
                    series={seriesByBoard.get(board.title)?.get(row.uuid)}
                    format={def?.format}
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
