const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup: use ./data/leaderboard.db, fallback to in-memory on disk error
const dataDir = path.join(__dirname, 'data');
let db;
try {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'leaderboard.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('Disk database unavailable:', err.message, '- using in-memory DB (scores will not persist).');
  db = new Database(':memory:');
}

// Create table if not exists
db.exec(`CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Prepared statements
const getLeaderboard = db.prepare('SELECT name, score FROM scores ORDER BY score DESC LIMIT 20');
const insertScore = db.prepare('INSERT INTO scores (name, score) VALUES (?, ?)');

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
  const { name, score } = req.body;
  if (!name || score === undefined) {
    return res.status(400).json({ error: 'Name and score are required' });
  }
  try {
    const result = insertScore.run(name, score);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});