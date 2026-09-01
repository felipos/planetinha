# The api and the worker run from THIS image, differing only by the script compose tells them to
# run — one build artifact to reason about, and one place upstream-calling code can live.
#
# A glibc base, not Alpine: the TypeScript loader this package runs through ships native binaries,
# and a musl mismatch surfaces as an opaque failure inside a container that is expensive to
# diagnose. The proxy image has no native dependencies and can be Alpine.
FROM node:24.16.0-bookworm-slim

WORKDIR /app

# Only the manifests first, so a dependency install is cached across source changes. Every
# workspace's manifest is needed for the lockfile to be validated, even though only the api's
# dependencies are installed.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Development dependencies are installed on purpose: this package runs from source through
# `@swc-node/register`, so its loader is a runtime requirement here rather than a build-time one.
# Install scripts are skipped because the only one is the repo's git-hook setup, which has nothing
# to do with an image.
RUN npm ci --workspace @vento/api --include-workspace-root --ignore-scripts

COPY apps/api apps/api

ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node

# Overridden per service in compose: the api serves, the worker sweeps.
CMD ["npm", "run", "start"]
