# River Raid Leaderboard

A nostalgic **River Raid**–style browser game with a persistent leaderboard. Fly over the river, shoot enemies, collect fuel, and compete for the high score.

## Features

- **Classic gameplay**: Scroll through the river, avoid or destroy enemy planes and helicopters, collect fuel tanks.
- **Leaderboard**: Enter your name before playing; your score is saved and shown in the top 20.
- **Responsive**: Works on desktop and mobile (touch controls).
- **Persian UI**: Right-to-left layout with Persian labels (امتیاز، سوخت، لیدربورد، etc.).

## Tech Stack

- **Frontend**: HTML5 Canvas, vanilla JavaScript, CSS (Vazirmatn font).
- **Backend**: Node.js, Express.
- **Database**: SQLite via `better-sqlite3` (stores scores in `data/leaderboard.db`; falls back to in-memory if disk is unavailable).

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)

## Installation

```bash
git clone <repo-url>
cd River-Raid-Leader-Board
npm install
```

## Running the App

**Production:**

```bash
npm start
```

Server runs at **http://localhost:3000** (or the port set in `PORT`).

**Development (auto-restart on file changes):**

```bash
npm run dev
```

## Docker

Build and run with Docker (scores persist in a volume):

```bash
docker build -t river-raid-leaderboard .
docker run -p 3000:3000 -v river-raid-data:/app/data river-raid-leaderboard
```

Open **http://localhost:3000**. Use `-v river-raid-data:/app/data` so the SQLite leaderboard survives container restarts.

## Build

Validate server syntax (no bundling):

```bash
npm run build
```

## Controls

| Input        | Action              |
|-------------|---------------------|
| **← / →**   | Move plane left/right |
| **Space**   | Shoot               |
| **Touch**   | Swipe to move, tap to shoot (mobile) |

## Project Structure

```
├── server.js          # Express server, API, SQLite setup
├── public/
│   ├── index.html     # Single-page UI (start / game / game over / leaderboard)
│   ├── game.js        # Canvas game logic, entities, drawing
│   └── style.css      # Layout, HUD, animations
├── data/              # Created at runtime; leaderboard.db stored here (gitignored)
└── package.json
```

## API

- `GET /api/leaderboard` — Returns top 20 scores `[{ name, score }, ...]`.
- `POST /api/score` — Submit a score. Body: `{ "name": "string", "score": number }`.

## License

Use and modify as you like. No formal license specified.
