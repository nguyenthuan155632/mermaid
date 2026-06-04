FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_WS_URL=ws://localhost:4026
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://mermaid:mermaid_password@postgresdb:5432/mermaid_db \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXTAUTH_SECRET=docker-build-placeholder-secret \
    NEXTAUTH_URL=http://localhost:4025
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    HOST=0.0.0.0 \
    PORT=4025

RUN apk add --no-cache \
    ca-certificates \
    chromium \
    freetype \
    harfbuzz \
    nss \
    ttf-freefont \
  && corepack enable \
  && addgroup -S nodejs \
  && adduser -S nextjs -G nodejs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs
EXPOSE 4025 4026
CMD ["pnpm", "start"]
