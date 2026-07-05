# Waypoint

A self-hostable, multi-user **project-management** web app. Sign in, then manage
**projects → tasks → subtasks**. Built as a **Vite + React** client and an
**Express + SQLite** API, managed as npm workspaces in one repo.

```
waypoint/
├── client/          Vite + React frontend (JS/JSX)
│   └── src/
│       ├── api.js           all backend calls
│       └── components/      AuthForm, Dashboard, TaskList, Subtasks
├── server/          Express API (JS)
│   └── src/
│       ├── db/              SQLite connection + schema
│       ├── models/          one module per table (plain SQL)
│       ├── routes/          auth, projects, tasks, subtasks
│       └── middleware/
├── eslint.config.js
└── package.json     workspace root + scripts
```

## Requirements

- Node.js >= 20 (`.nvmrc` pins 20)

## Getting started

```bash
npm install                     # installs all workspaces (from the repo root)
cp server/.env.example server/.env
# edit server/.env — set a real SESSION_SECRET
npm run dev                     # client :5173, server :3000
```

Open http://localhost:5173, register an account, and start adding projects.
The SQLite file is created automatically at `server/data/waypoint.db`.

## Scripts (from the repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Run client and server together |
| `npm run build` | Production build of the client → `client/dist` |
| `npm start` | Run the API server |
| `npm test` | Run tests in every workspace (Vitest) |
| `npm run lint` | ESLint over the repo |
| `npm run format` | Prettier write |
| `npm run db:migrate --workspace server` | Create/upgrade the SQLite database |

## Data model

`users` → `projects` → `tasks` → `subtasks`, each linked by a foreign key with
`ON DELETE CASCADE`. All API queries are scoped to the logged-in user, so users
only ever see their own data.

## Auth

Cookie-based sessions (`express-session`), stored in the same SQLite file.
Passwords are hashed with `bcryptjs`. In development the Vite proxy makes the
client and API same-origin, so login works with no extra config.

## Deploying on Windows (media server)

- SQLite uses `better-sqlite3`, which ships **prebuilt Windows binaries** — a
  plain `npm install` on the server works without a C++ toolchain.
- Set real values in `server/.env`: `NODE_ENV=production`, a long random
  `SESSION_SECRET`, and `CLIENT_ORIGIN` if the client is served from a different
  origin. Cookies are marked `secure` in production, so serve over HTTPS.
- Build the client (`npm run build`) and serve `client/dist` from your web
  server (or add static serving to Express). Run the API with `npm start`,
  ideally under a process manager so it restarts with the machine.
