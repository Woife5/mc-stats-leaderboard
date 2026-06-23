import type { Board } from '../types';
import Row from './Row';

export default function FeaturedBoards({ boards }: { boards: Board[] }) {
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-4">
      {boards.map(board => (
        <div key={board.title} className="p-3.5 rounded-2xl bg-panel border border-border">
          <h3 className="my-1 text-lg font-semibold">{board.title}</h3>
          {board.rows.length ? (
            board.rows
              .slice(0, 5)
              .map(row => (
                <Row key={row.uuid} name={row.name} value={row.displayValue ?? String(row.value)} />
              ))
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
