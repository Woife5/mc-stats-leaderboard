FROM node:alpine
WORKDIR /app
COPY . .
ENV STATS_DIR=/data/stats
EXPOSE 3000
CMD ["node", "server.js"]
