# Builds the frontend and serves it from a reverse proxy that also forwards the API path. That
# forwarding is what makes the frontend's relative path work in production the same way the dev
# server's proxy makes it work locally — which is why no CORS configuration exists anywhere.
FROM node:24.16.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Install scripts are skipped: the only one is the repo's git-hook setup, which has nothing to do
# with an image.
RUN npm ci --workspace @planetinha/web --include-workspace-root --ignore-scripts

COPY apps/web apps/web
RUN npm run build --workspace @planetinha/web

# No native dependencies here, so Alpine is free of the musl concern that rules it out for the api.
FROM nginx:1.29.4-alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
