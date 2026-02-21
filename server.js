const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup: use ./data/leaderboard.db, fallback to in-memory store if native bindings unavailable
const dataDir = path.join(__dirname, 'data');
let getLeaderboard;
let insertScore;

function createInMemoryStore() {
  let nextId = 1;
  const scores = [];
  return {
    getLeaderboard: {
      all() {
        return scores
          .slice()
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
          .map(({ name, score }) => ({ name, score }));
      },
    },
    insertScore: {
      run(name, score) {
        const entry = {
          id: nextId++,
          name,
          score,
          timestamp: new Date().toISOString(),
        };
        scores.push(entry);
        return { lastInsertRowid: entry.id };
      },
    },
  };
}

try {
  const Database = require('better-sqlite3');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'leaderboard.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  getLeaderboard = db.prepare('SELECT name, score FROM scores ORDER BY score DESC LIMIT 20');
  insertScore = db.prepare('INSERT INTO scores (name, score) VALUES (?, ?)');
} catch (err) {
  console.warn('SQLite unavailable:', err.message, '- using in-memory store (scores will not persist).');
  const store = createInMemoryStore();
  getLeaderboard = store.getLeaderboard;
  insertScore = store.insertScore;
}

// Routes
app.get('/api/leaderboard', (req, res) => {
  try {
    const rows = getLeaderboard.all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/score', (req, res) => {
  res.status(403).json({ error: 'Scores must be submitted via game session.' });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = new Map();

function initRiver(width, height) {
  const riverSegments = [];
  const segCount = Math.ceil(height / 20) + 30;
  let drift = 0;
  for (let i = 0; i < segCount; i++) {
    drift += (Math.random() - 0.5) * 8;
    drift = Math.max(-width * 0.15, Math.min(width * 0.15, drift));
    const riverW = width * 0.65 + Math.sin(i * 0.08) * 40;
    riverSegments.push({ cx: width / 2 + drift, w: riverW });
  }
  return riverSegments;
}

function createBaseState(width, height) {
  return {
    width,
    height,
    riverSegments: initRiver(width, height),
    player: {
      width: 38,
      height: 44,
      x: width / 2 - 19,
      y: height - 44 - 20,
      speed: 7,
      tilt: 0,
      engineFlicker: 0,
    },
    enemies: [],
    bullets: [],
    particles: [],
    score: 0,
    fuel: 100,
    frameCount: 0,
    scrollOffset: 0,
    screenShake: 0,
    gameRunning: false,
    lastShotAt: 0,
    nextBulletId: 1,
  };
}

function createParticles(state, x, y, color, count = 25) {
  const colors = color === '#ff0000'
    ? ['#ff4444', '#ff8800', '#ffcc00', '#ff2200', '#ff6600']
    : color === '#ffff00' || color === '#ffaa00'
    ? ['#ffee44', '#ffaa00', '#ff8800', '#ffcc22', '#ffffff']
    : ['#44ff88', '#00ff66', '#88ffaa', '#22dd66', '#aaffcc'];

  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      type: 'explosion',
      vx: Math.cos(Math.random() * Math.PI * 2) * (Math.random() * 6 + 2),
      vy: Math.sin(Math.random() * Math.PI * 2) * (Math.random() * 6 + 2),
      life: 40 + Math.random() * 30,
      maxLife: 60 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
    });
  }
  for (let i = 0; i < count / 2; i++) {
    state.particles.push({
      x,
      y,
      type: 'spark',
      vx: Math.cos(Math.random() * Math.PI * 2) * (Math.random() * 3 + 0.5),
      vy: Math.sin(Math.random() * Math.PI * 2) * (Math.random() * 3 + 0.5),
      life: 20 + Math.random() * 15,
      maxLife: 35 + Math.random() * 5,
      color: '#ffffff',
      size: Math.random() * 3 + 1,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
    });
  }
  state.screenShake = 8;
}

function startGame(session, playerName) {
  session.playerName = playerName;
  session.state = createBaseState(session.state.width, session.state.height);
  session.state.gameRunning = true;
}

function gameOver(session) {
  session.state.gameRunning = false;
  try {
    insertScore.run(session.playerName || 'Player', session.state.score);
  } catch (err) {
    console.warn('Failed to save score:', err.message);
  }
  safeSend(session.ws, {
    type: 'game_over',
    data: { score: session.state.score },
  });
}

function safeSend(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function updateState(session, now) {
  const s = session.state;
  if (!s.gameRunning) return;

  s.frameCount++;
  const segH = 20;
  const scrollWrap = s.riverSegments.length * segH;
  s.scrollOffset = (s.scrollOffset - 2.5 + scrollWrap) % scrollWrap;

  // Player input
  const input = session.input;
  if (input.left) {
    s.player.x -= s.player.speed;
    s.player.tilt -= 0.3;
  }
  if (input.right) {
    s.player.x += s.player.speed;
    s.player.tilt += 0.3;
  }
  s.player.tilt *= 0.85;
  s.player.x = Math.max(0, Math.min(s.width - s.player.width, s.player.x));

  // Shooting (rate limit)
  if (input.shoot && now - s.lastShotAt > 180) {
    s.bullets.push({
      id: s.nextBulletId++,
      x: s.player.x + s.player.width / 2 - 2,
      y: s.player.y - 10,
      width: 4,
      height: 14,
      speed: 8,
    });
    s.lastShotAt = now;
  }

  // Spawn enemies
  if (Math.random() < 0.04 + Math.min(s.score / 2000, 0.03)) {
    const rand = Math.random();
    const enemy = {
      id: Date.now() + Math.random(),
      width: 36,
      height: 20,
      x: Math.random() * (s.width - 60) + 20,
      y: -50,
      speed: 3 + Math.random() * 1.5,
      type: 0,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.03 + Math.random() * 0.03,
      wobbleAmp: 0.5 + Math.random() * 1,
      heliRotor: 0,
    };
    if (rand < 0.55) enemy.type = 0;
    else if (rand < 0.85) enemy.type = 1;
    else enemy.type = 2;
    s.enemies.push(enemy);
  }

  // Update enemies
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    e.wobble += e.wobbleSpeed;
    e.y += e.speed;
    if (e.type === 1) e.x += Math.sin(e.wobble) * e.wobbleAmp;
    if (e.y > s.height + 50) s.enemies.splice(i, 1);
  }

  // Player-enemy collision
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    if (s.player.x < e.x + e.width &&
        s.player.x + s.player.width > e.x &&
        s.player.y < e.y + e.height &&
        s.player.y + s.player.height > e.y) {
      if (e.type === 2) {
        s.fuel = Math.min(100, s.fuel + 25);
        s.score += 5;
        createParticles(s, e.x + e.width / 2, e.y + e.height / 2, '#00ff66', 15);
        s.enemies.splice(i, 1);
      } else {
        createParticles(s, s.player.x + s.player.width / 2, s.player.y + s.player.height / 2, '#ff0000', 40);
        gameOver(session);
        return;
      }
    }
  }

  // Update bullets
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    s.bullets[i].y -= s.bullets[i].speed;
    if (s.bullets[i].y < -20) s.bullets.splice(i, 1);
  }

  // Bullet-enemy collision
  outer: for (let b = s.bullets.length - 1; b >= 0; b--) {
    for (let e = s.enemies.length - 1; e >= 0; e--) {
      const bul = s.bullets[b];
      const en = s.enemies[e];
      if (bul && en &&
          bul.x < en.x + en.width &&
          bul.x + bul.width > en.x &&
          bul.y < en.y + en.height &&
          bul.y + bul.height > en.y) {
        if (en.type === 2) {
          s.fuel = Math.min(100, s.fuel + 25);
          s.score += 5;
          createParticles(s, en.x + en.width / 2, en.y + en.height / 2, '#00ff66', 18);
        } else {
          s.score += 10;
          createParticles(s, en.x + en.width / 2, en.y + en.height / 2, '#ffaa00', 25);
        }
        s.enemies.splice(e, 1);
        s.bullets.splice(b, 1);
        continue outer;
      }
    }
  }

  // Update particles
  s.particles = s.particles.filter(p => p.life > 0);
  s.particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.vx *= 0.98;
    p.life--;
    p.rotation += p.rotSpeed;
  });

  // Screen shake decay
  s.screenShake *= 0.88;
  if (s.screenShake < 0.3) s.screenShake = 0;

  // Fuel drain
  s.fuel -= 0.08;
  if (s.fuel <= 0) {
    s.fuel = 0;
    createParticles(s, s.player.x + s.player.width / 2, s.player.y + s.player.height / 2, '#ff0000', 30);
    gameOver(session);
    return;
  }
}

wss.on('connection', (ws) => {
  const state = createBaseState(800, 600);
  const session = {
    ws,
    state,
    input: { left: false, right: false, shoot: false },
    playerName: '',
    timer: null,
  };
  sessions.set(ws, session);

  safeSend(ws, { type: 'init', data: { width: state.width, height: state.height, riverSegments: state.riverSegments } });

  ws.on('message', (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg.toString());
    } catch {
      return;
    }

    if (payload.type === 'init' || payload.type === 'resize') {
      const width = Math.max(320, Math.min(900, Number(payload.data?.width) || 800));
      const height = Math.max(360, Math.min(900, Number(payload.data?.height) || 600));
      session.state.width = width;
      session.state.height = height;
      session.state.player.x = Math.min(session.state.player.x, width - session.state.player.width);
      session.state.player.y = height - session.state.player.height - 20;
      session.state.riverSegments = initRiver(width, height);
      safeSend(ws, { type: 'init', data: { width, height, riverSegments: session.state.riverSegments } });
    }

    if (payload.type === 'start') {
      const name = String(payload.data?.name || '').trim().slice(0, 20);
      if (!name) return;
      startGame(session, name);
      if (!session.timer) {
        session.timer = setInterval(() => {
          const now = Date.now();
          updateState(session, now);
          safeSend(ws, { type: 'state', data: session.state });
        }, TICK_MS);
      }
    }

    if (payload.type === 'input') {
      const data = payload.data || {};
      session.input.left = !!data.left;
      session.input.right = !!data.right;
      session.input.shoot = !!data.shoot;
    }
  });

  ws.on('close', () => {
    if (session.timer) clearInterval(session.timer);
    sessions.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
