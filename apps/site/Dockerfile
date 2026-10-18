# Public marketing site + knowledge base. Build context is the repo root (npm workspaces).
FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_APP_URL=https://app.bidaxiom.com
ARG NEXT_PUBLIC_SITE_URL=https://www.bidaxiom.com
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

WORKDIR /app
COPY . .
RUN npm ci \
 && npm run build --workspace=apps/site
ENV NODE_ENV=production

WORKDIR /app/apps/site
EXPOSE 3002
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3002}"]
