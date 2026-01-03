import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors()); 
app.use(express.json());

const dbPath = path.join(__dirname, 'auth.db');
const db = await open({
  filename: dbPath,
  driver: sqlite3.Database
});

app.get('/api/health', async (req, res) => {
  const countResult = await db.get('SELECT COUNT(*) as total FROM Users');
  
  res.json({
    status: 'Сервер работает',
    time: new Date().toLocaleTimeString(),
    usersCount: countResult.total
  });
});

app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  
  const user = await db.get(
    'SELECT * FROM Users WHERE user_login = ? AND user_password = ?',
    [login, password]
  );
  console.table(user)
  if (user) {
    return res.json({
      success: true,
      message: 'Вход выполнен',
      user: { 
        id: user.user_id,
        login: user.user_login 
      }
    });
  }
  
  res.status(401).json({
    success: false,
    message: 'Неверный логин или пароль'
  });
});

app.post('/api/forgotPassword', async (req, res) => {
  const {login, newPassword} = req.body;

  const user = await db.get(
    `SELECT user_login FROM Users WHERE user_login = ?`,
    [login]
  )
  
  if (user) {
    const result = await db.run(
      'UPDATE Users SET user_password = ? WHERE user_login = ?',
      [newPassword, login]
    )

    res.status(201).json({
    success: true,
    message: 'Пароль успешно обновлен',
    userLogin: login,
    userId: result.lastID  
  });
  } else {
      return res.status(409).json({
        success: false,
        error: 'Пользователь не найден',
        message: 'Пользователь с таким логином не найден'
      });
  }
})

app.post('/api/createUser', async (req, res) => { 
  const { login, password } = req.body;
  
  const existingUser = await db.get(
    `SELECT user_login FROM Users WHERE user_login = ?`,
    [login]
  );

  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'Логин уже занят',
      message: 'Пользователь с таким логином уже существует'
    });
  }

  const result = await db.run(  
    'INSERT INTO Users(user_login, user_password) VALUES (?, ?)',
    [login, password]
  );
  
  res.status(201).json({
    success: true,
    message: 'Пользователь создан успешно',
    userLogin: login,
    userId: result.lastID  
  });
});

app.get('/api/todo/:userId', async (req, res) => {
  try {
    const { userId } = req.params; 
    const tasks = await db.all(
      'SELECT * FROM Tasks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
        
    return res.json({
      success: true,
      tasks 
    });
    
  } catch (error) {
    console.error('Ошибка получения задач:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

app.delete('/api/todo/delete/:taskId', async (req, res) => {
  const {taskId} = req.params;
  const result = await db.run(
    'DELETE FROM Tasks WHERE task_id = ?',
    [taskId]
  )
  if (result.changes > 0) {
    return res.json({
      success: true,
    });
  }
  res.status(500).json({
    success: false,
    message: 'Ошибка сервера'
  });
});

app.post('/api/todo/edit', async (req, res) => {
  const {taskId, newTaskName} = req.body;
  const result = await db.run(
    'UPDATE Tasks SET task_name = ? WHERE task_id = ?',
    [newTaskName, taskId]
  )
  if (result.changes > 0) {
    return res.json({
      success: true,
    });
  }
  res.status(500).json({
    success: false,
    message: 'Ошибка сервера'
  });
});

app.post('/api/todo', async (req, res) => {
  const newTask = req.body;

  const result = await db.run(
    'INSERT INTO Tasks(user_id, task_name, done) VALUES (?,?,0)',
    [newTask.user_id, newTask.text]
  ) 
  if (result) {
    const addedTask = await db.get(
      'SELECT * FROM Tasks WHERE task_id = ?',
      [result.lastID]
    );
    console.table(addedTask)
    return res.json({
      success: true,
      newTask: addedTask
    })
  }

  console.error('Ошибка получения задач:', error);
  res.status(500).json({
    success: false,
    message: 'Ошибка сервера'
  });
})

app.get('/api/users', async (req, res) => {
  const users = await db.all('SELECT user_id, user_login FROM Users');
  
  res.json({
    message: 'Список пользователей',
    count: users.length,
    users: users
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});