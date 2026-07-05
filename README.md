# Waypoint

A full-stack JavaScript web app: a **Vite + React** client and an **Express** JSON API,
managed as npm workspaces in one repo.

```
waypoint/
├── client/          Vite + React frontend (JS/JSX)
│   └── src/
├── server/          Express API (JS)
│   └── src/
│       └── routes/
├── eslint.config.js Shared ESLint (flat) config
└── package.json     Workspace root + scripts
```

## Requirements

- Node.js >= 20 (`.nvmrc` pins 20)

## Getting started

```bash
npm install          # install all workspaces (run from the repo root)
cp server/.env.example server/.env
cp client/.env.example client/.env   # optional; defaults work in dev
npm run dev          # client on :5173, server on :3000
```

Open http://localhost:5173 — the page fetches `/api/health` from the server
(proxied by Vite in dev) and shows the API status.

## Scripts (run from the repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Run client and server together |
| `npm run dev:client` / `npm run dev:server` | Run just one side |
| `npm run build` | Production build of the client → `client/dist` |
| `npm start` | Run the API server |
| `npm test` | Run tests in every workspace (Vitest) |
| `npm run lint` | ESLint over the repo |
| `npm run format` | Prettier write (`format:check` to verify) |

## How the client talks to the server

The client calls the API under the `/api` prefix. In development Vite proxies
`/api` to `http://localhost:3000`, so there's no CORS or base URL to configure
locally. For other environments, set `VITE_API_URL` in the client.
