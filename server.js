import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors()); 
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  CREATE TABLE IF NOT EXISTS Users (
    user_id SERIAL PRIMARY KEY,
    user_login VARCHAR(50) UNIQUE NOT NULL,
    user_password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS Tasks (
    task_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    done BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => {
  console.log('Таблицы PostgreSQL готовы');
}).catch(err => {
  console.error('Ошибка таблиц:', err.message);
});


app.get('/api/health', async (req, res) => {
  const result = await pool.query('SELECT COUNT(*) as total FROM Users');
  
  res.json({
    status: 'Сервер работает',
    time: new Date().toLocaleTimeString(),
    usersCount: result.rows[0].total
  });
});

app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  
  const result = await pool.query(
    'SELECT * FROM Users WHERE user_login = $1 AND user_password = $2',
    [login, password]
  );
  
  if (result.rows.length > 0) {
    const user = result.rows[0];
    console.table(user);
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
  const { login, newPassword } = req.body;

  const userResult = await pool.query(
    'SELECT user_login FROM Users WHERE user_login = $1',
    [login]
  );
  
  if (userResult.rows.length > 0) {
    const result = await pool.query(
      'UPDATE Users SET user_password = $1 WHERE user_login = $2 RETURNING user_id',
      [newPassword, login]
    );

    res.status(201).json({
      success: true,
      message: 'Пароль успешно обновлен',
      userLogin: login,
      userId: result.rows[0].user_id
    });
  } else {
    return res.status(409).json({
      success: false,
      error: 'Пользователь не найден',
      message: 'Пользователь с таким логином не найден'
    });
  }
});

app.post('/api/createUser', async (req, res) => { 
  const { login, password } = req.body;
  
  const existingUser = await pool.query(
    'SELECT user_login FROM Users WHERE user_login = $1',
    [login]
  );

  if (existingUser.rows.length > 0) {
    return res.status(409).json({
      success: false,
      error: 'Логин уже занят',
      message: 'Пользователь с таким логином уже существует'
    });
  }

  const result = await pool.query(
    'INSERT INTO Users(user_login, user_password) VALUES ($1, $2) RETURNING user_id',
    [login, password]
  );
  
  res.status(201).json({
    success: true,
    message: 'Пользователь создан успешно',
    userLogin: login,
    userId: result.rows[0].user_id
  });
});

app.get('/api/todo/:userId', async (req, res) => {
  try {
    const { userId } = req.params; 
    const result = await pool.query(
      'SELECT * FROM Tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
        
    return res.json({
      success: true,
      tasks: result.rows
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
  const { taskId } = req.params;
  const result = await pool.query(
    'DELETE FROM Tasks WHERE task_id = $1',
    [taskId]
  );
  
  if (result.rowCount > 0) {
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
  const { taskId, newTaskName } = req.body;
  const result = await pool.query(
    'UPDATE Tasks SET task_name = $1 WHERE task_id = $2',
    [newTaskName, taskId]
  );
  
  if (result.rowCount > 0) {
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

  try {
    const result = await pool.query(
      'INSERT INTO Tasks(user_id, task_name, done) VALUES ($1, $2, false) RETURNING *',
      [newTask.user_id, newTask.text]
    );
    
    const addedTask = result.rows[0];
    console.table(addedTask);
    return res.json({
      success: true,
      newTask: addedTask
    });
  } catch (error) {
    console.error('Ошибка добавления задачи:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

app.get('/api/users', async (req, res) => {
  const result = await pool.query('SELECT user_id, user_login FROM Users');
  
  res.json({
    message: 'Список пользователей',
    count: result.rows.length,
    users: result.rows
  });
});

app.get('/api/admin/download-db', async (req, res) => {
  res.status(501).json({ 
    success: false, 
    message: 'Функция скачивания БД недоступна для PostgreSQL' 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});