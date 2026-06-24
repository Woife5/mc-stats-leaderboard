import type { Category, StatsByCategory } from '../types';
import { humanize } from '../lib/format';

interface ControlsProps {
  categories: Category[];
  statsByCategory: StatsByCategory;
  category: string;
  stat: string;
  onCategoryChange: (category: string) => void;
  onStatChange: (stat: string) => void;
}

const FIELD_CLASS =
  'bg-[#0c1326] text-text border border-border rounded-xl px-3 py-2.5 font-[inherit]';

export default function Controls({
  categories,
  statsByCategory,
  category,
  stat,
  onCategoryChange,
  onStatChange,
}: ControlsProps) {
  const stats = [...(statsByCategory[category] || [])].sort();

  return (
    <section className="bg-panel/90 border border-border rounded-2xl p-4 backdrop-blur-md flex gap-3 items-end flex-wrap mb-4">
      <label className="flex flex-col gap-1.5">
        Category
        <select className={FIELD_CLASS} value={category} onChange={e => onCategoryChange(e.target.value)}>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        Stat
        <select className={FIELD_CLASS} value={stat} onChange={e => onStatChange(e.target.value)}>
          {stats.length ? (
            stats.map(s => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))
          ) : (
            <option value="">No stats</option>
          )}
        </select>
      </label>
    </section>
  );
}
