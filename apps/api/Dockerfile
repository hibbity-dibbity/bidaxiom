# Fastify + tRPC API. Build context is the repo root (npm workspaces).
FROM node:22-bookworm-slim

# Chromium for Puppeteer PDF generation. Puppeteer uses this binary instead of downloading its own.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY . .
# Install devDependencies too: the API imports the TypeScript source of @construction/shared and runs via tsx.
# NODE_ENV is set only after install, because npm ci skips devDependencies when NODE_ENV=production.
RUN npm ci
ENV NODE_ENV=production

WORKDIR /app/apps/api
EXPOSE 10000
CMD ["npx", "tsx", "src/server.ts"]
