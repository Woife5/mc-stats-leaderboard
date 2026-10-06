// Presentation helper: derive the "increased since the previous day" tooltip
// details for a stat. Returns undefined when there is nothing to show.

import type { IncreaseDetails } from '../types';
import { formatDateKey, formatSnapshotAge } from './format';
import type { DailySnapshot } from './history';

/** Labels describing the snapshot a value is compared against. */
export interface Comparison {
  since: string;
  snapshotAge: string;
}

export function describeComparison(previous: DailySnapshot | null): Comparison | undefined {
  if (!previous) return undefined;
  return { since: formatDateKey(previous.date), snapshotAge: formatSnapshotAge(previous.savedAt) };
}

export function buildIncrease(
  format: (value: number) => string,
  currentValue: number,
  previousValue: number | undefined,
  comparison?: Comparison,
): IncreaseDetails | undefined {
  if (previousValue === undefined || !comparison || currentValue <= previousValue) return undefined;

  return {
    previous: format(previousValue),
    delta: `+${format(currentValue - previousValue)}`,
    since: comparison.since,
    snapshotAge: comparison.snapshotAge,
  };
}
