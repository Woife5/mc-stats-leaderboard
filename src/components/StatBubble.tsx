import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SeriesPoint } from '../lib/history';
import type { IncreaseDetails } from '../types';
import HistoryChart from './HistoryChart';
import { useHistoryPopover } from './HistoryPopover';
import Sparkline from './Sparkline';

interface StatBubbleProps {
  children: ReactNode;
  increase?: IncreaseDetails;
  series?: SeriesPoint[];
  format?: (value: number) => string;
  /** What the value describes, used for the history button and popover title. */
  label?: string;
}

const CHIP_CLASS = 'relative group inline-flex items-center rounded-full bg-chip px-2 py-0.5 text-[#cfe0ff]';
const TOOLTIP_CLASS =
  'pointer-events-none absolute right-0 top-full z-10 mt-1 hidden min-w-max rounded-lg border border-border bg-[#0c1326] px-2 py-1 text-left text-xs text-text shadow-lg group-hover:block';

const POPOVER_WIDTH = 280;
const VIEWPORT_MARGIN = 16;
const GAP = 4;

export default function StatBubble({ children, increase, series, format, label }: StatBubbleProps) {
  const id = useId();
  const [open, setOpen] = useHistoryPopover(id);
  const hasHistory = !!series && series.length >= 2;
  const summary = increase ? `${increase.delta} since ${increase.since}` : undefined;

  const arrow = increase ? (
    <span className="ml-1 text-green-400" aria-label={`Increased by ${increase.delta} since ${increase.since}`}>
      ↑
    </span>
  ) : null;

  const details = increase ? (
    <>
      <span className="block font-semibold text-green-300">{summary}</span>
      <span className="block text-muted">Previous: {increase.previous}</span>
      <span className="block text-muted">Last snapshot: {increase.snapshotAge}</span>
    </>
  ) : null;

  if (!hasHistory) {
    return (
      <span className={CHIP_CLASS}>
        {children}
        {arrow}
        {details ? <span className={TOOLTIP_CLASS}>{details}</span> : null}
      </span>
    );
  }

  return (
    <HistoryBubble
      series={series}
      format={format ?? String}
      label={label}
      summary={summary}
      open={open}
      setOpen={setOpen}
      chipContent={
        <>
          {children}
          {arrow}
        </>
      }
      tooltip={
        <>
          {details}
          <span className={`block text-green-400 ${details ? 'mt-1.5' : ''}`}>
            <Sparkline series={series} className="block h-5 w-28" />
          </span>
          <span className="mt-1 block text-[11px] text-muted">Click for history</span>
        </>
      }
    >
      {children}
    </HistoryBubble>
  );
}

function HistoryBubble({
  chipContent,
  tooltip,
  children,
  series,
  format,
  label,
  summary,
  open,
  setOpen,
}: {
  chipContent: ReactNode;
  tooltip: ReactNode;
  children: ReactNode;
  series: SeriesPoint[];
  format: (value: number) => string;
  label?: string;
  summary?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const popoverId = useId();

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const place = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const width = Math.min(POPOVER_WIDTH, vw - VIEWPORT_MARGIN * 2);
      // Right-aligned under the bubble, clamped to the screen.
      const left = Math.min(Math.max(rect.right - width, VIEWPORT_MARGIN), vw - VIEWPORT_MARGIN - width);
      const height = popoverRef.current?.offsetHeight ?? 0;
      const below = rect.bottom + GAP;
      const fitsBelow = below + height <= vh - GAP;
      const fitsAbove = rect.top - GAP - height >= GAP;
      const top = !fitsBelow && fitsAbove ? rect.top - GAP - height : below;
      setPosition({ top, left, width });
    };

    place();
    // Second pass once the popover has rendered and its height is known.
    const frame = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    // Capture phase: the trigger and popover stop keydown propagation so row handlers don't react.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, setOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={e => {
          e.stopPropagation();
          setOpen(!open);
        }}
        onKeyDown={e => e.stopPropagation()}
        className={`${CHIP_CLASS} shrink-0 cursor-pointer whitespace-nowrap transition-colors hover:bg-[#26375c] focus-visible:outline-2 focus-visible:outline-accent ${
          open ? 'bg-[#26375c]' : ''
        }`}
      >
        {chipContent}
        <span className="sr-only">, show history for {label ?? 'this stat'}</span>
        {open ? null : (
          <span aria-hidden="true" className={`${TOOLTIP_CLASS} group-focus-visible:block`}>
            {tooltip}
          </span>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="dialog"
              aria-label={`History for ${label ?? 'this stat'}`}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                width: position?.width ?? POPOVER_WIDTH,
                visibility: position ? 'visible' : 'hidden',
              }}
              className="fixed z-50 max-w-[calc(100vw-2rem)] cursor-default rounded-lg border border-border bg-[#0c1326] p-3 text-left text-xs text-text shadow-lg whitespace-normal"
            >
              {label ? <div className="truncate text-muted">{label}</div> : null}
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-base font-semibold text-[#cfe0ff]">{children}</span>
                {summary ? <span className="font-semibold text-green-300">{summary}</span> : null}
              </div>
              <HistoryChart series={series} format={format} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
