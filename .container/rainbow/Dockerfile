# syntax=docker/dockerfile:1.7
ARG NODE_RUNTIME_VERSION=26.5.0
FROM node:${NODE_RUNTIME_VERSION}-bookworm-slim AS build

ARG NPM_RUNTIME_VERSION=12.0.2
ARG APP_BRAND_NAME
ARG APP_BRAND_TAGLINE
ARG VITE_PLATFORM_API_URL=/api/platform
WORKDIR /workspace/techmedia
COPY . .
RUN --mount=type=cache,id=rainbow-client-npm,target=/root/.npm \
  printf 'APP_BRAND_NAME=%s\nAPP_BRAND_TAGLINE=%s\nVITE_PLATFORM_API_URL=%s\n' "$APP_BRAND_NAME" "$APP_BRAND_TAGLINE" "$VITE_PLATFORM_API_URL" > .env && \
  npm exec --yes --package=npm@${NPM_RUNTIME_VERSION} -- npm ci --no-audit --no-fund && \
  npm exec --yes --package=npm@${NPM_RUNTIME_VERSION} -- npm run build && rm .env

FROM build AS verify
RUN npm run check

FROM build AS api-runtime
RUN install -d -o node -g node -m 700 /home/node/.codex
USER node
EXPOSE 7050
CMD ["sh", "-c", "umask 077 && exec node dist/platform/api/server.js"]

FROM nginx:1.28-alpine AS web-runtime
COPY .container/rainbow/nginx-spa.conf /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/techmedia/dist/platform/web /usr/share/nginx/html
EXPOSE 80
