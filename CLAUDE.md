# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Waypoint is a full-stack JavaScript web app organized as npm workspaces:

- `client/` — Vite + React frontend (plain JS/JSX)
- `server/` — Express JSON API (plain JS)

Everything is ES modules (`"type": "module"`) and requires Node >= 20. There is
no TypeScript.

## Commands

Run from the repo root unless noted.

- `npm install` — install all workspace deps (once, from root)
- `npm run dev` — run client (:5173) and server (:3000) together
- `npm run dev:client` / `npm run dev:server` — run one side only
- `npm run build` — production build of the client → `client/dist`
- `npm start` — run the API server
- `npm test` — run tests in every workspace
- `npm run lint` — ESLint over the whole repo
- `npm run format` / `npm run format:check` — Prettier write / verify

Running a single test (Vitest):

- Client: `npm test --workspace client -- src/App.test.jsx`
- Server: `npm test --workspace server -- health`
- Filter by name: append `-t "partial test name"`

## Architecture

**Client ↔ server contract:** the client calls the API under the `/api` prefix.
In dev, Vite proxies `/api` → `http://localhost:3000` (`client/vite.config.js`),
so there's no CORS or base URL to configure locally. In other environments the
client reads `VITE_API_URL`; the server restricts CORS to `CLIENT_ORIGIN`.

**Server (`server/src`):**

- `index.js` — entry point; only starts the HTTP listener.
- `app.js` — builds and returns the Express app via `createApp()`. Kept separate
  from `index.js` so tests import the app without binding a port (see
  `server/test/health.test.js`, which drives it with supertest).
- `config.js` — reads env (via dotenv) into a single `config` object. Read env
  through this object, not `process.env` directly.
- `routes/` — one router per resource, mounted under `/api/<name>` in `app.js`.
  Add a resource by creating `routes/<name>.js` and mounting it in `createApp`.

**Client (`client/src`):**

- `main.jsx` — React root.
- `App.jsx` — top-level component.
- `api.js` — all backend fetch calls live here; components import from it rather
  than calling `fetch` inline.

## Conventions

- ES module imports must include the file extension (`./app.js`, `./App.jsx`).
- Prettier is authoritative for formatting (single quotes, semicolons, trailing
  commas, 100 columns). Run `npm run format` before committing.
- Tests use Vitest in both workspaces; client tests run in jsdom with Testing
  Library. Place server tests in `server/test/`, client tests beside the code as
  `*.test.jsx`.
