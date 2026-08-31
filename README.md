# Vento

An interactive 3D globe that visualizes worldwide temperature data as a color gradient, built with React, TypeScript, Three.js, and Vite.
Temperature data is fetched from the [Open-Meteo](https://open-meteo.com/) API (no API key required).

## Requirements

- Node.js >= 24 (see `.nvmrc`; run `nvm use` if you use nvm)

## Getting started

Install dependencies:

```sh
npm install
```

Run the dev server (fetches live data from Open-Meteo):

```sh
npm run dev
```

Run the dev server with mocked temperature data (no network calls):

```sh
npm run dev:mock
```

The app will be available at the URL printed in the terminal (usually `http://localhost:5173`).

## Other scripts

```sh
npm run build    # Type-check and build for production
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
npm run test     # Run the test suite with Vitest
```

## Project structure

The codebase follows a layered architecture:

- `src/domain` — core types and logic (grid points, temperature readings, color scale, interpolation)
- `src/application` — use cases and ports (fetching the temperature grid, selecting a point)
- `src/infrastructure` — data source implementations (Open-Meteo API client, mock data source)
- `src/presentation` — React components and hooks (the globe, UI)

Tests live under `tests/` (`unit`, `component`, `integration`).
