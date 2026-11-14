# syntax=docker/dockerfile:1.7

# Backend runtime image: Node 24 LTS on Debian slim (glibc, so bcrypt prebuilds
# and Prisma engines work without musl surprises). The image is multi-stage:
# only compiled output and production dependencies reach the final layer.
FROM node:24.20.0-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Build tools are needed only if a native package (bcrypt) has no prebuild.
# They stay in this intermediate stage and never reach the runtime image.
FROM base AS build-base
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

FROM build-base AS build
ENV DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json tsconfig.seed.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY openapi.yaml ./openapi.yaml
# Generate the custom-output Prisma client, compile the API, and compile the
# seed + its Docker-only empty-DB guard to plain JavaScript.
RUN npx prisma generate \
  && npx tsc -p tsconfig.json \
  && npx tsc -p tsconfig.seed.json \
  && find dist dist-seed -name '*.map' -delete

FROM build-base AS prod-deps
COPY package.json package-lock.json ./
# `prisma` is a production dependency because the container runs
# `prisma migrate deploy` at startup. Everything else is a runtime dependency.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production \
  PORT=4000
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-seed ./dist-seed
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/openapi.yaml ./openapi.yaml
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
