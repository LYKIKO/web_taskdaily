require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16751,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper function to get strict Phnom Penh Date (YYYY-MM-DD)
function getPhnomPenhDate() {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Phnom_Penh',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

// Auto-Migration & Table Verification
async function initDB() {
    let connection;
    try {
        connection = await pool.getConnection();
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category ENUM('daily', 'custom') DEFAULT 'daily',
                task_time VARCHAR(50) DEFAULT NULL,
                completed TINYINT(1) DEFAULT 0,
                last_completed_date DATE DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Safely add missing columns if they don't exist
        const [timeCols] = await connection.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'task_time'`, [process.env.DB_NAME]);
        if (timeCols.length === 0) await connection.execute(`ALTER TABLE tasks ADD COLUMN task_time VARCHAR(50) DEFAULT NULL`);

        const [dateCols] = await connection.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'last_completed_date'`, [process.env.DB_NAME]);
        if (dateCols.length === 0) await connection.execute(`ALTER TABLE tasks ADD COLUMN last_completed_date DATE DEFAULT NULL`);

        console.log('Database ready and synchronized (Phnom Penh Timezone Applied).');
    } catch (err) {
        console.error('Database initialization error:', err.message);
    } finally {
        if (connection) connection.release();
    }
}
initDB();

// Middleware: Automatic Daily Reset (Phnom Penh Time)
app.use(async (req, res, next) => {
    try {
        const today = getPhnomPenhDate();
        await pool.execute(
            `UPDATE tasks 
             SET completed = 0, last_completed_date = NULL 
             WHERE category = 'daily' 
             AND completed = 1 
             AND (last_completed_date IS NULL OR last_completed_date < ?)`,
            [today]
        );
    } catch (err) {
        console.error('Error during daily reset check:', err.message);
    }
    next();
});

// API: Get All Tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT * FROM tasks 
            ORDER BY 
                completed ASC, 
                CASE 
                    WHEN task_time = 'Anytime' OR task_time IS NULL THEN '23:59'
                    ELSE STR_TO_DATE(task_time, '%l:%i %p')
                END ASC, 
                id DESC
        `);
        res.json(rows);
    } catch (err) {
        try {
            const [rowsFallback] = await pool.execute('SELECT * FROM tasks ORDER BY completed ASC, id DESC');
            res.json(rowsFallback);
        } catch (fallbackErr) {
            res.status(500).json({ error: err.message });
        }
    }
});

// API: Create Task
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, category, task_time } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ error: 'Task title cannot be empty' });
        
        const taskCategory = category === 'custom' ? 'custom' : 'daily';
        const formattedTime = task_time ? task_time : 'Anytime';

        // Simulate slight network delay for satisfying spinner UI effect (optional, remove if you want instant)
        await new Promise(r => setTimeout(r, 400)); 

        const [result] = await pool.execute(
            'INSERT INTO tasks (title, category, task_time, completed) VALUES (?, ?, ?, 0)',
            [title.trim(), taskCategory, formattedTime]
        );
        res.json({ id: result.insertId, title: title.trim(), category: taskCategory, task_time: formattedTime, completed: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Toggle Task Completion
app.patch('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { completed } = req.body;
        const today = getPhnomPenhDate(); 
        
        const completedVal = completed ? 1 : 0;
        const dateVal = completed ? today : null;

        await pool.execute('UPDATE tasks SET completed = ?, last_completed_date = ? WHERE id = ?', [completedVal, dateVal, id]);
        res.json({ success: true, completed: completedVal });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Delete Task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await new Promise(r => setTimeout(r, 300)); // Slight delay for spinner visual
        await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TaskDaily server online at http://localhost:${PORT}`));
