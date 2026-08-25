# Daily Tasks (MySQL-backed)

A clean, animated daily task tracker with a Node.js + Express backend that
stores everything in your MySQL database, and a mobile-app-style frontend.

## What's inside
- `server.js` — Express API that talks to MySQL (auto-creates the `tasks` table on first run)
- `public/index.html` — the UI (single file, animated, mobile + desktop responsive)
- `schema.sql` — the table schema (for reference / manual setup)
- `.env` — your database credentials (already filled in for you)

## Run it locally
1. Install [Node.js](https://nodejs.org) if you don't have it (v18+ recommended).
2. Open a terminal in this folder and run:
   ```
   npm install
   npm start
   ```
3. Open **http://localhost:3000** in your browser.

The server connects to your MySQL database at startup and creates the
`tasks` table automatically if it doesn't exist yet — no manual SQL needed.

## How daily vs custom tasks work
- **Daily** tasks automatically reset to "not done" each day (checked server-side
  whenever the task list is loaded, based on the date they were last completed).
- **Custom** tasks stay as one-off items and don't reset.

## API reference
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | List all tasks (auto-resets stale daily tasks) |
| POST | `/api/tasks` | Create a task `{ name, type: 'daily'|'custom', priority: 'normal'|'high' }` |
| PATCH | `/api/tasks/:id/toggle` | Toggle done/not done |
| DELETE | `/api/tasks/:id` | Delete a task |
| DELETE | `/api/tasks-completed/all` | Clear all completed tasks |
| GET | `/api/health` | Database connectivity check |

## Deploying
This is a standard Node/Express app, so it deploys anywhere that runs Node
(Railway, Render, Fly.io, a VPS, etc.). Just make sure the same environment
variables from `.env` are set in your hosting platform, and that the platform
can reach `db.us-losa1.bengt.wasmernet.com:16751`.

## Security note
`.env` contains your live database password. Don't commit this folder to a
public GitHub repo or share it — if you need to share the project, remove
`.env` first and let collaborators fill in their own copy.
