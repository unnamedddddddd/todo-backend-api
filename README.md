## Admin endpoints (pet project, not secure)
Базовый URL:
text
https://todo-backend-api-ec5z.onrender.com
Все доступные API маршруты:

1. Проверка здоровья сервера:
GET    /api/health

  2. Авторизация:
POST   /api/login

3. Регистрация:
POST   /api/createUser

4. Сброс пароля:
POST   /api/forgotPassword

5. Задачи (ToDo):
Получить задачи пользователя:
GET    /api/todo/:userId

Добавить задачу:
POST   /api/todo

Удалить задачу:
DELETE /api/todo/delete/:taskId

Редактировать задачу:
POST   /api/todo/edit

6. Проверка БД (debug):

GET    /api/debug/db