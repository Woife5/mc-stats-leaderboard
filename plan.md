# Plan: daily stat history in the browser + history graphs

## Goal
Store the current stats of all players as **one entry per local day** in IndexedDB on every page load. The existing increase indicators keep working but compare against that history. A sparkline sits next to each value and opens a larger history chart when clicked or tapped.

## Background (current state on `main`)
- **Saving and reading the snapshot:** `src/lib/statSnapshot.ts` stores one snapshot in localStorage under the key `mc-stats-leaderboard:stats-snapshot:v1`, shaped `{ version: 1, savedAt, players: { [uuid]: { name, stats } } }`.
  - `src/App.tsx` reads it once with `useState(loadPreviousStatsSnapshot)`.
  - It saves it again 250 ms after data arrives (`saveStatsSnapshot(players)`).
  - It passes it as `previousSnapshot` to `FeaturedBoards`, `Leaderboard`, `PlayersList` and `PlayerDetail`.
  - Components read the previous value with `getPreviousStat(snapshot, uuid, category, stat)`.
- **Building the increase:** `src/lib/increase.ts` `buildIncrease(format, current, previous, snapshotAge)` → `IncreaseDetails` (the type lives in `src/types.ts`).
  - `src/lib/format.ts` `formatSnapshotAge(savedAt)` provides the age text.
- **Showing it:** `src/components/StatBubble.tsx` renders the value chip, a green ↑ and a tooltip that only appears on hover ("{delta} since last refresh", "Previous:", "Refreshed:").
  - `src/components/Row.tsx` passes `increase` through to it.
  - `PlayersList.tsx` uses `StatBubble` directly for play time.
- **Derived values:** `FeaturedBoards.tsx` computes the previous value with `def.getValue(previousPlayer.stats, ctx)`, because its boards are derived stats rather than raw ones.
- **Stack:** React 19, Vite, TypeScript, Tailwind 4, pnpm. Run `pnpm check` (tsc) and `pnpm build`.
- **Local test data:** the dev server (`pnpm dev`) serves the local `stats/` folder and `usercache.json`. Both exist locally and are gitignored.

## Scope
**In scope:**
- Saving the daily history in IndexedDB.
- Moving the existing localStorage snapshot over to the new store.
- Switching the increase indicators to read from the history.
- Small sparkline graphs.
- A bigger chart that opens on tap or click.

**Out of scope:**
- Any change to the overall look or layout of the app.
- Server-side or backend work.
- New npm dependencies (no chart library, no IndexedDB wrapper).
- Loading anything from a CDN.
- Thinning out or cleaning up old history entries.

## Requirements

### 1. Storage: `src/lib/history.ts` (replaces `statSnapshot.ts`)
- **Database:** use plain IndexedDB.
  - Database `mc-stats-leaderboard`, version `1`, object store `daily` with `keyPath: 'date'`.
  - Entry type: `interface DailySnapshot { date: string /* local YYYY-MM-DD */; savedAt: number; players: Record<string, { name: string; stats: StatsByCategoryValues }> }`.
- **Date key:** `localDateKey(d = new Date())` builds `YYYY-MM-DD` from the browser's *local* date (`getFullYear` / `getMonth` / `getDate`, zero-padded). Do not use `toISOString`, which gives the UTC date.
- **`loadHistory(): Promise<DailySnapshot[]>`:** returns all entries sorted by date, oldest first.
- **`saveToday(players): Promise<DailySnapshot>`:** `put`s the current stats under today's key, overwriting any existing entry for today, and returns the entry.
- **Migration:** inside `loadHistory`, if the old localStorage key exists and is valid (same check as the current `isSnapshot`):
  - write it as an entry for `localDateKey(new Date(savedAt))`, but only if that date has no entry yet;
  - then remove the localStorage key.
- **Keep data longer:** call `navigator.storage?.persist?.()` once, without awaiting it and ignoring any error.
- **Fail softly:** if IndexedDB is unavailable or any call fails, catch the error, return `[]` (or no-op), and the app runs without indicators or graphs. Never throw into the UI.
- **No clean-up:** no pruning, expiry or size limits. The data stays until the user clears their browser data.

### 2. Hook: `src/hooks/useStatHistory.ts`
- **Load:** on mount, call `loadHistory()` and hold the result in state.
- **Save:** once stats have loaded (`hasData`), call `saveToday(players)` (keep the existing 250 ms debounce), then replace or append today's entry in the in-memory list so today's point appears straight away.
- **Returns:**
  - `history: DailySnapshot[]` — all entries, including today.
  - `previous: DailySnapshot | null` — the **most recent entry whose `date` is before today's local date**. Never use today's entry, because it's overwritten on each reload and would compare with itself.
- **Wiring:** `App.tsx` uses this hook instead of `loadPreviousStatsSnapshot` / `saveStatsSnapshot` and passes `history` and `previous` down instead of `previousSnapshot`.

### 3. Increase indicators (keep them, change only the source)
- **Same UI:** keep `StatBubble`'s green ↑ and the hover tooltip as they are.
- **Compare against `previous`:**
  - replace `getPreviousStat(previousSnapshot, …)` with an equivalent that reads from `previous.players[uuid].stats`;
  - in `FeaturedBoards`, keep using `def.getValue(previous.players[uuid].stats, ctx)`.
- **Tooltip text:**
  - "{delta} since last refresh" becomes "{delta} since {date}", where `{date}` is `previous.date` formatted for display (e.g. `toLocaleDateString` from the local date parts).
  - "Refreshed: {age}" becomes "Last snapshot: {date}" (or reuse `formatSnapshotAge(previous.savedAt)`, e.g. "3 days ago"; pick one and use it everywhere).
  - Update the `aria-label` the same way.
- **No earlier day yet** (`previous` is `null`): no indicator, exactly like today when there's no snapshot.
- `buildIncrease` and `IncreaseDetails` can stay, with only `snapshotAge` renamed or reused for the new label.

### 4. Series helper (in `history.ts` or `src/lib/series.ts`)
- **`buildSeries(history, uuid, getValue: (stats) => number | undefined): SeriesPoint[]`:**
  - `SeriesPoint = { date: string; value: number }`.
  - Produces one point per day where the player exists and `getValue` returns a number, ordered by date.
- **The `getValue` parameter:**
  - raw stats pass `s => s?.[category]?.[stat]`;
  - `FeaturedBoards` passes `s => def.getValue(s, ctx)`.
- **`dailyGains(series)`:** returns `{ date, gain }[]`, where each gain is the value minus the previous point's value (minimum 0), skipping the first point.

### 5. Sparkline + history chart
- **`StatBubble` props:** add `series?: SeriesPoint[]` and `format?: (v: number) => string`. Keep `increase` and the chip.
- **When `series` has fewer than 2 points:** render exactly what's shown today.
- **When `series` has 2 or more points:** show a **sparkline** next to the chip.
  - It's a small inline SVG (about 48×16 px), a `polyline` of the series values.
  - x is placed by real date (days since the first point), so missing days show as longer segments.
  - y is scaled from min to max; a flat series draws a horizontal line in the middle.
  - Use the existing green accent (`text-green-400`, `stroke="currentColor"`).
  - Make the sparkline a `<button type="button">` with an `aria-label` like `Show history for {name}`.
- **Popover with a larger chart:** clicking or tapping the sparkline opens a popover. Use click/tap, not hover-only, so it works on mobile.
  - **Style:** same visual style as the existing tooltip (`border-border bg-[#0c1326] rounded-lg shadow-lg`), about 280 px wide, constrained to the screen (`max-w-[calc(100vw-2rem)]`), right-aligned under the bubble.
  - **Header:** the current value plus the same "+X since {date}" text as the indicator, if there is one.
  - **Range toggle:** `7d` / `30d` / `All` (default `30d`) filters the points by date.
  - **Chart (SVG):**
    - daily gains as green bars (one per day, using `dailyGains`);
    - the running total as a line drawn over the bars on its own scale;
    - the first and last date as small labels under the chart;
    - the min and max of the running total as small labels.
    - Show a "Not enough history yet" text when the selected range has fewer than 2 points.
  - **Closing:** click outside, the `Escape` key, or tapping the sparkline again. Only one popover is open at a time; a small context holding the open id is fine.
  - The ↑ hover tooltip and the popover must not overlap. Hide the tooltip while the popover is open.
- **Components to update** (pass `series` + `format` alongside `increase`):
  - `Row.tsx`: add `series` and `format` props and pass them through.
  - `Leaderboard.tsx`: `buildSeries(history, row.uuid, s => s?.[category]?.[stat])`; format `v => formatCustomStat(stat, v)`.
  - `PlayersList.tsx`: play time (`minecraft:custom` / `minecraft:play_time`).
  - `PlayerDetail.tsx`: series per entry for the active category only.
  - `FeaturedBoards.tsx`: series through `def.getValue(stats, ctx)` with `def.format`.
- **Removal:** delete `src/lib/statSnapshot.ts` once nothing uses it.

### 6. Performance
History can grow to hundreds of days, so:
- memoise series building per component with `useMemo` (keyed on `history`, uuid and stat);
- keep the sparkline SVGs light (one `polyline`, no per-point elements).

## Acceptance criteria
- **Saving:**
  - After a page load, IndexedDB `mc-stats-leaderboard` → `daily` contains exactly one entry with today's local date.
  - Reloading on the same day overwrites it (`savedAt` updates, entry count stays the same).
  - An existing `mc-stats-leaderboard:stats-snapshot:v1` localStorage value is turned into an entry for its own date, and the localStorage key is removed.
- **Increase indicators:**
  - With only today's entry: none are shown.
  - With an earlier entry: the ↑ and tooltip appear wherever a value went up compared with the **most recent earlier day**, and the tooltip names that date.
  - Reloading again on the same day still compares against that same earlier day.
- **Graphs:**
  - With at least 2 days of data, sparklines appear in Featured boards, the Leaderboard, the Players list and Player details.
  - Clicking or tapping one opens the chart popover with gain bars, the total line, date and min/max labels, a working 7d/30d/All toggle, and the "+X since {date}" text.
  - The popover closes on outside click and on `Escape`.
- **Mobile:** the popover works by tapping and stays inside a 390 px wide screen.
- **Robustness:** if IndexedDB is unavailable, the app still loads and works, just without indicators or graphs.
- **Dependencies:** no new dependencies, and no requests to external hosts.
- **Builds:** `pnpm check` and `pnpm build` pass.

## Verification (agent must do this itself)
1. Run `pnpm check` and `pnpm build`.
2. Run `pnpm dev`, open the app, and confirm today's entry in IndexedDB. Confirm no indicators are shown on a fresh database.
3. **Seed fake history** in the browser console. Copy today's entry into about 40 earlier dates with gaps, with values scaled down (e.g. each number × `1 - k*0.02`) so the totals rise over time. Then reload. Check:
   - the ↑ indicators and tooltip dates against the most recent earlier seeded day;
   - sparklines and popovers in all four places;
   - each range of the toggle;
   - missing days showing as longer line segments;
   - flat series drawing a straight line.
4. Reload again on the same day and confirm the indicators still compare against the same earlier day.
5. Check that moving the old snapshot over works: put a valid old-format snapshot in localStorage with `savedAt` set to 3 days ago, delete the IndexedDB database, reload, and confirm an entry for that date exists, the localStorage key is gone, and the indicators compare against that date.
6. Check at a mobile size (390×844) and on desktop that the popover opens by tap or click, stays on screen, and closes as expected.
7. Remove all seeded test data when you're done.

## Report back
- Files added, changed and removed.
- Any decisions made where this plan left room (e.g. the tooltip date format, how only one popover stays open).
- Verification evidence: command output and what was checked in the browser.
- Known limitations: history is per browser, starts on the first visit, and has gaps on days nobody visited.
