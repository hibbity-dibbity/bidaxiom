# Next.js web app. Build context is the repo root (npm workspaces).
FROM node:22-bookworm-slim

ARG NEXT_PUBLIC_API_URL
ARG SKIP_TYPECHECK=0
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    SKIP_TYPECHECK=$SKIP_TYPECHECK

WORKDIR /app
COPY . .
# Shown at the bottom of the sidebar so it is easy to tell which build is running.
ARG BUILD_ID=dev
ENV NEXT_PUBLIC_BUILD_ID=$BUILD_ID
# npm ci must include devDependencies (Tailwind, PostCSS, TypeScript) for the build.
RUN npm ci \
 && npm run build --workspace=apps/web
ENV NODE_ENV=production

WORKDIR /app/apps/web
EXPOSE 10000
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-10000}"]
