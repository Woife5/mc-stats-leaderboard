// Resolves a player UUID to a display name using a runtime name map built from
// the Minecraft server's usercache.json (see loadUserCache in ../lib/api).
//
// Any UUID not present in the map is rendered verbatim — a signal that the
// player isn't in the server's user cache yet (e.g. they haven't connected
// since the cache was last written).

export function resolveName(uuid: string, names: Record<string, string>): string {
  return names[uuid] ?? names[uuid.toLowerCase()] ?? uuid;
}
