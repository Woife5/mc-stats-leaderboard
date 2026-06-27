// Presentation helper: derive the "increased since last snapshot" tooltip
// details for a stat. Returns undefined when there is nothing to show.

import type { IncreaseDetails } from '../types';

export function buildIncrease(
  format: (value: number) => string,
  currentValue: number,
  previousValue: number | undefined,
  snapshotAge?: string,
): IncreaseDetails | undefined {
  if (previousValue === undefined || currentValue <= previousValue) return undefined;

  return {
    previous: format(previousValue),
    delta: `+${format(currentValue - previousValue)}`,
    snapshotAge,
  };
}
