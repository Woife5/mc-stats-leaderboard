# mc-stats-leaderboard

Self-hosted Minecraft stats dashboard using only Node.js built-ins.

## Run locally

```bash
npm start
```

There are no npm dependencies; `npm install` is optional.

Defaults to `STATS_DIR=/Users/simonkrenn/Downloads/stats`.

## Environment

- `STATS_DIR` directory containing `UUID.json` files
- `PORT` defaults to `3000`
- `MOJANG_CACHE_TTL_HOURS` controls how long fetched usernames are cached, default `24`

Player names are fetched from Mojang's profile API using each stats filename UUID and cached in `player-names-cache.json`.

Optional `player-names.json` in the app root overrides Mojang names:

```json
{"uuid":"Friendly Name"}
```

## Docker

```bash
docker build -t mc-stats-leaderboard .
docker run --rm -p 3000:3000 -e STATS_DIR=/data/stats -v /path/to/stats:/data/stats mc-stats-leaderboard
```

Open http://localhost:3000
