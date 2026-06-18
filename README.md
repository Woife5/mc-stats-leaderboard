# mc-stats-leaderboard

A fully static, self-hosted Minecraft stats dashboard.

The container is just [`joseluisq/static-web-server`](https://static-web-server.net/)
serving the web app and the raw player `UUID.json` files from your Minecraft
world. All parsing, aggregation, leaderboards and rendering happen in the
browser.

No third-party APIs, no backend process, no caches. The `package.json` exists
only for project metadata, CI versioning, and frontend tooling scripts.

## How it works

* The Minecraft server writes `<world>/stats/<UUID>.json` files.
* This container exposes that directory as `/stats/` over HTTP, with JSON
  directory listings enabled.
* `index.html` + `app.js` fetch the listing, load every player file, build the
  leaderboards, and render the UI.
* Player names come from a hardcoded `PLAYER_NAMES` map at the top of
  `public/app.js`. Any UUID not in the map is rendered verbatim — a signal
  that the map needs an update.

## Run with Docker

```bash
docker build -t mc-stats-leaderboard .

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
2. Add an entry to the `PLAYER_NAMES` object at the top of
   [`public/app.js`](public/app.js):

   ```js
   const PLAYER_NAMES = {
     // ...existing entries...
     '00000000-0000-0000-0000-000000000000': 'NewPlayerName',
   };
   ```
3. Rebuild and redeploy:

   ```bash
   docker build -t mc-stats-leaderboard .
   # then restart your container
   ```

Removed whitelist members stay in the map intentionally — their historical
stats still appear on leaderboards with their proper name.

## Local development

No build step. The easiest local loop is the Docker-backed npm script:

```bash
npm run dev
```

Then open <http://localhost:8080>. The script builds the production image and
live-mounts `public/` plus the repo-local `stats/` directory.

You can also serve `public/` with `static-web-server` directly, as long as the
directory listing returns JSON:

```bash
# install via Homebrew / cargo / docker
static-web-server \
  --root public \
  --port 8080 \
  --directory-listing=true \
  --directory-listing-format=json
```

Or run the Docker image with live-mounted source files for fast iteration:

```bash
docker run --rm -p 8080:80 \
  -v "$PWD/public/app.js:/public/app.js:ro" \
  -v "$PWD/public/index.html:/public/index.html:ro" \
  -v "$PWD/public/styles.css:/public/styles.css:ro" \
  -v "$PWD/stats:/public/stats:ro" \
  mc-stats-leaderboard
```

The repo's `stats/` directory (gitignored) is for local testing — drop a few
real `<UUID>.json` files there.

Plain static hosts such as GitHub Pages are not enough by themselves, because
the app needs `/stats/` to return a JSON directory listing. Use the Docker image
or configure another static server with equivalent directory-listing behavior.

## Refresh model

The page loads everything on every full page reload. There is no background
polling. Hit reload (or Cmd/Ctrl+R) to pick up new stats.

All `fetch` calls append a `?t=<timestamp>` cache-buster so the static
server's default `Cache-Control` headers don't get in the way.
