FROM joseluisq/static-web-server:2-alpine

WORKDIR /public

# Copy the pre-built React app (produced by `pnpm build` on the host/CI into
# ./dist). The stats directory is expected to be bind-mounted at /public/stats
# at runtime (read-only) from the MC server's world data.
COPY ./dist /public

# Configuration via environment variables.
# HTTPS is expected to be handled by an upstream reverse proxy.
ENV SERVER_PORT=80
ENV SERVER_ROOT=/public
ENV SERVER_LOG_LEVEL=warn
ENV SERVER_COMPRESSION=true
ENV SERVER_DIRECTORY_LISTING=true
ENV SERVER_DIRECTORY_LISTING_FORMAT=json

EXPOSE 80
