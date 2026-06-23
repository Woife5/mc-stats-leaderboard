// Player UUID -> display name map.
//
// To add a new player: append a "<uuid>": "<name>" entry below, rebuild, and
// redeploy. Any UUID not present here is rendered verbatim — a signal that
// this map needs an update.
//
// Removed whitelist members stay in the map intentionally — their historical
// stats still appear on leaderboards with their proper name.

export const PLAYER_NAMES: Record<string, string> = {
  '44ed0b57-d1eb-437f-8bbd-230ee4be8199': 'PlomeHD',
  '5f290be5-057b-4c91-bae2-125b0622fb68': 'Hetzy',
  '67866cbc-f2ac-42ed-a8ac-95d196542e7f': 'YungM0n',
  'cb731c2a-4e4c-4089-8d16-e63ad9a83f5b': 'Wolfgang_x',
  'ce689bf3-b20c-4c28-9ccf-453a8a12bc4b': 'Sunzi555',
  'cf3e20ab-2505-456e-8c87-51e79586c195': 'manujell',
  'e567583f-871a-41fd-920d-2b0e7a77255b': 'DaDaniel_',
  '600b999b-7fa8-4ebd-ad93-010151347dd8': 'MauzBoi',
};

export function resolveName(uuid: string): string {
  return PLAYER_NAMES[uuid] || PLAYER_NAMES[uuid.toLowerCase()] || uuid;
}
