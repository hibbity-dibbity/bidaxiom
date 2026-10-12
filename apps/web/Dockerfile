# Next.js web app. Build context is the repo root (npm workspaces).
FROM node:22-bookworm-slim

ARG NEXT_PUBLIC_API_URL
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /app
COPY . .
RUN npm ci \
 && npm run build --workspace=apps/web

WORKDIR /app/apps/web
EXPOSE 10000
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-10000}"]
