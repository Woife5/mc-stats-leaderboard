# mc-stats-leaderboard

A self-hosted Minecraft stats dashboard. The frontend is a React app (built
with [Vite](https://vite.dev/) + TypeScript + [Tailwind CSS](https://tailwindcss.com/)).

The production container is just
[`joseluisq/static-web-server`](https://static-web-server.net/) serving the
prebuilt app bundle and the raw player `UUID.json` files from your Minecraft
world. All parsing, aggregation, leaderboards and rendering happen in the
browser — there is no backend process, no third-party APIs, and no caches.

## How it works

* The Minecraft server writes `<world>/stats/<UUID>.json` files.
* The container exposes that directory as `/stats/` over HTTP, with JSON
  directory listings enabled.
* The app fetches the listing, loads every player file, builds the
  leaderboards, and renders the UI.
* Player names come from the `PLAYER_NAMES` map in
  [`src/data/playerNames.ts`](src/data/playerNames.ts). Any UUID not in the map
  is rendered verbatim — a signal that the map needs an update.

## Build model

The app is built **on your host / in CI** (not inside Docker), and the
resulting `dist/` directory is copied into the image. This keeps the
multi-arch image build fast and free of an emulated Node toolchain.

```bash
pnpm install
pnpm build          # outputs ./dist

docker build -t mc-stats-leaderboard .
```

## Run with Docker

```bash
docker run --rm -p 8080:80 \
  -v /path/to/mc-server/world/stats:/public/stats:ro \
  mc-stats-leaderboard
```

Then open <http://localhost:8080>.

Mount read-only (`:ro`) so the container can never modify the live MC server
data.

## Adding a new player

When a new player gets added to the whitelist (and has played at least once,
so a stats file exists):

1. Find the new UUID. Easiest way: open the dashboard — the new player will
   appear with their raw UUID as the display name. Or look directly in
   `<world>/stats/` for a freshly created `*.json` file.
2. Add an entry to the `PLAYER_NAMES` object in
   [`src/data/playerNames.ts`](src/data/playerNames.ts):

   ```ts
   export const PLAYER_NAMES: Record<string, string> = {
     // ...existing entries...
     '00000000-0000-0000-0000-000000000000': 'NewPlayerName',
   };
   ```
3. Rebuild and redeploy:

   ```bash
   pnpm build
   docker build -t mc-stats-leaderboard .
   # then restart your container
   ```

Removed whitelist members stay in the map intentionally — their historical
stats still appear on leaderboards with their proper name.

## Local development

```bash
pnpm install
pnpm dev
```

Then open the URL Vite prints (default <http://localhost:5173>). The Vite dev
server runs with hot module reloading and includes a dev-only middleware that
serves the repo-local `stats/` directory at `/stats/`, mirroring the JSON
directory-listing format that `static-web-server` produces in production. This
means the app code is identical in dev and prod.

The repo's `stats/` directory (gitignored) is for local testing — drop a few
real `<UUID>.json` files there.

Other useful scripts:

```bash
pnpm check          # type-check the project (tsc -b)
pnpm build          # production build into ./dist
pnpm preview        # preview the production build locally
```

### Testing the production image

To exercise the exact production setup (static-web-server serving the built
bundle plus a bind-mounted stats directory):

```bash
pnpm build
docker build -t mc-stats-leaderboard .
docker run --rm -p 8080:80 \
  -v "$PWD/stats:/public/stats:ro" \
  mc-stats-leaderboard
```

Plain static hosts such as GitHub Pages are not enough by themselves, because
the app needs `/stats/` to return a JSON directory listing. Use the Docker
image or configure another static server with equivalent directory-listing
behavior.

## Refresh model

The page loads everything on every full page reload. There is no background
polling. Hit reload (or Cmd/Ctrl+R) to pick up new stats.

All `fetch` calls append a `?t=<timestamp>` cache-buster so the static
server's default `Cache-Control` headers don't get in the way.
