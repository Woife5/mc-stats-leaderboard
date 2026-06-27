// Formatting helpers. React handles HTML escaping, so no escapeHtml here.

const fmt = new Intl.NumberFormat('de-AT');

export function humanize(id: string): string {
  return String(id).split(':').pop()!.replace(/_/g, ' ');
}

export function formatNumber(n: number): string {
  return fmt.format(n);
}

export function formatDurationTicks(ticks: number): string {
  const seconds = Math.floor(ticks / 20);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDistanceCm(cm: number): string {
  const m = cm / 100;
  if (m >= 1000) return `${formatNumber(Number((m / 1000).toFixed(m >= 10000 ? 0 : 1)))} km`;
  return `${formatNumber(Number(m.toFixed(m >= 100 ? 0 : 1)))} m`;
}

export function formatHearts(tenths: number): string {
  return `${formatNumber(tenths / 20)} ❤`;
}

export function formatCustomStat(statId: string, value: number): string {
  if (typeof statId === 'string' && statId.endsWith('_one_cm')) return formatDistanceCm(value);
  if (
    statId === 'minecraft:play_time' ||
    statId === 'minecraft:sneak_time' ||
    statId === 'minecraft:total_world_time' ||
    (typeof statId === 'string' && statId.startsWith('minecraft:time_since_'))
  )
    return formatDurationTicks(value);
  if (typeof statId === 'string' && statId.startsWith('minecraft:damage_')) return formatHearts(value);
  return formatNumber(value);
}

export function formatSnapshotAge(savedAt: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  if (elapsedSeconds < 60) return 'just now';

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}
