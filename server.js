import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import { hashPassword, comparePassword, generateToken, authMiddleware } from './jwtUtilits.js'

const app = express();
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/api/debug/db', async (req, res) => {
  try {
    const tables = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Найдено таблиц:', tables.rows.length);
    
    const result = {
      connection: 'Подключено к PostgreSQL',
      databaseInfo: {},
      tables: []
    };
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`\nТаблица: ${tableName}`);
      
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position`, 
    [tableName]);
      
      const data = await pool.query(`SELECT * FROM "${tableName}"`);
      
      const tableInfo = {
        name: tableName,
        type: table.table_type,
        columns: columns.rows,
        rowCount: data.rows.length,
        sampleData: data.rows
      };
      
      result.tables.push(tableInfo);
      console.log(`Колонки: ${columns.rows.map(c => c.column_name).join(', ')}`);
      console.log(`Записей: ${data.rows.length}`);
    }
    
    const totalUsers = await pool.query('SELECT COUNT(*) FROM Users');
    const totalTasks = await pool.query('SELECT COUNT(*) FROM Tasks');
    
    result.stats = {
      totalUsers: totalUsers.rows[0].count,
      totalTasks: totalTasks.rows[0].count
    };
    
    console.log('\nСтатистика:');
    console.log(` Пользователей: ${result.stats.totalUsers}`);
    console.log(` Задач: ${result.stats.totalTasks}`);
    
    res.json(result);
    
  } catch (error) {
    console.error('Ошибка при проверке БД:', error);
    res.status(500).json({ 
      error: 'Ошибка базы данных',
      details: error.message,
    });
  }
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
    'SELECT * FROM Users WHERE user_login = $1',
    [login]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      message: 'Неверный логин'
    });
  }

  const user = result.rows[0];

  const isPasswordValid = await comparePassword(password, user.user_password);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Неверный логин или пароль'
    });
  }
  
  const token = generateToken(user.user_id);
   
  console.table(user);
  res.json({
    success: true,
    message: 'Вход выполнен',
    user: { 
      id: user.user_id,
      login: user.user_login 
    },
    token
  });
});

app.post('/api/forgotPassword', async (req, res) => {
  const { login, newPassword } = req.body;

  const userResult = await pool.query(
    'SELECT user_login FROM Users WHERE user_login = $1',
    [login]
  );
  
  if (userResult.rows.length > 0) {
    const hashedPassword = await hashPassword(newPassword);
    const result = await pool.query(
      'UPDATE Users SET user_password = $1 WHERE user_login = $2 RETURNING user_id',
      [hashedPassword, login]
    );

    return res.status(201).json({
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

  const hashedPassword = await hashPassword(password);

  const result = await pool.query(
    'INSERT INTO Users(user_login, user_password) VALUES ($1, $2) RETURNING user_id',
    [login, hashedPassword]
  );
  
  const token = generateToken(result.rows[0].user_id)

  res.status(201).json({
    success: true,
    message: 'Пользователь создан успешно',
    userLogin: login,
    userId: result.rows[0].user_id,
    token
  });
});

app.get('/api/todo/:userId',authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params; 
    const result = await pool.query(
      'SELECT * FROM Tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
        
    res.json({
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

app.delete('/api/todo/delete/:taskId',authMiddleware, async (req, res) => {
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
  return res.status(500).json({
    success: false,
    message: 'Ошибка сервера'
  });
});

app.post('/api/todo/edit',authMiddleware, async (req, res) => {
  const { taskId, newTaskName } = req.body;
  const result = await pool.query(
    'UPDATE Tasks SET task_name = $1 WHERE task_id = $2',
    [newTaskName, taskId]
  );
  
  if (result.rowCount > 0) {
    res.json({
      success: true,
    });
  }
  res.status(500).json({
    success: false,
    message: 'Ошибка сервера'
  });
});

app.post('/api/todo' ,authMiddleware, async (req, res) => {
  const newTask = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO Tasks(user_id, task_name, done) VALUES ($1, $2, false) RETURNING *',
      [newTask.user_id, newTask.text]
    );
    
    const addedTask = result.rows[0];
    console.table(addedTask);
    res.json({
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});