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
* Player names are resolved from your server's `usercache.json` (a file the
  Minecraft server maintains automatically, mapping UUIDs to the last-known
  names). Mount it into the container (see below) and new players appear with
  their proper names — no rebuild needed. Any UUID not found in the cache is
  rendered verbatim.

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
  -v /path/to/mc-server/usercache.json:/public/usercache.json:ro \
  mc-stats-leaderboard
```

Then open <http://localhost:8080>.

Mount read-only (`:ro`) so the container can never modify the live MC server
data.

The second mount is optional but recommended: `usercache.json` lives in your
Minecraft server's root directory (next to `world/`) and lets the dashboard
display player names instead of raw UUIDs. The Minecraft server updates this
file on its own as players connect, so the leaderboard picks up new players and
name changes on the next page reload — no rebuild required. If you omit the
mount, everything still works but players show up as bare UUIDs.

## Player names

Names are resolved at runtime from your server's `usercache.json`, so there is
nothing to configure or rebuild when players come and go:

* A new player appears on the leaderboard as soon as they have a stats file and
  are present in `usercache.json` (the Minecraft server adds them on connect).
* Players who have left the server keep their proper name as long as they remain
  in the cache, so their historical stats stay readable.
* Any UUID that isn't in the cache is rendered as the raw UUID — a hint that the
  `usercache.json` mount is missing or that player hasn't connected recently.

Just reload the dashboard to pick up changes.

## Local development

```bash
pnpm install
pnpm dev
```

Then open the URL Vite prints (default <http://localhost:5173>). The Vite dev
server runs with hot module reloading and includes a dev-only middleware that
serves the repo-local `stats/` directory at `/stats/` and a repo-local
`usercache.json` at `/usercache.json`, mirroring the JSON directory-listing
format and user-cache file that `static-web-server` serves in production. This
means the app code is identical in dev and prod.

The repo's `stats/` directory and `usercache.json` file (both gitignored) are
for local testing — drop a few real `<UUID>.json` files into `stats/`, and
optionally copy your server's `usercache.json` into the repo root to see real
names. Without it, players render as raw UUIDs.

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
  -v "$PWD/usercache.json:/public/usercache.json:ro" \
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
