require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('daily', 'custom') NOT NULL DEFAULT 'custom',
        priority ENUM('normal', 'high') NOT NULL DEFAULT 'normal',
        done TINYINT(1) NOT NULL DEFAULT 0,
        last_done_date DATE NULL,
        created_at BIGINT NOT NULL
      )
    `);
    console.log('Database ready: tasks table exists.');
  } finally {
    conn.release();
  }
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Reset daily tasks that were completed on a previous day
async function resetStaleDailyTasks() {
  await pool.query(
    `UPDATE tasks
     SET done = 0, last_done_date = NULL
     WHERE type = 'daily' AND done = 1 AND (last_done_date IS NULL OR last_done_date <> ?)`,
    [todayStr()]
  );
}

// GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    await resetStaleDailyTasks();
    const [rows] = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks', detail: err.message });
  }
});

// CREATE task
app.post('/api/tasks', async (req, res) => {
  try {
    const { name, type, priority } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Task name is required' });

    const id = 't_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const taskType = type === 'daily' ? 'daily' : 'custom';
    const taskPriority = priority === 'high' ? 'high' : 'normal';
    const createdAt = Date.now();

    await pool.query(
      `INSERT INTO tasks (id, name, type, priority, done, last_done_date, created_at)
       VALUES (?, ?, ?, ?, 0, NULL, ?)`,
      [id, name.trim(), taskType, taskPriority, createdAt]
    );

    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task', detail: err.message });
  }
});

// TOGGLE done state
app.patch('/api/tasks/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });

    const task = rows[0];
    const newDone = task.done ? 0 : 1;
    const lastDoneDate = newDone ? todayStr() : null;

    await pool.query('UPDATE tasks SET done = ?, last_done_date = ? WHERE id = ?', [
      newDone,
      lastDoneDate,
      id
    ]);

    const [updated] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle task', detail: err.message });
  }
});

// DELETE single task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task', detail: err.message });
  }
});

// DELETE all completed tasks
app.delete('/api/tasks-completed/all', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE done = 1');
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear completed tasks', detail: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Daily Tasks app running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
