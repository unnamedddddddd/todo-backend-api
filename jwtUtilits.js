import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

export const hashPassword = async password => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
}

export const generateToken = userId => {
  return jwt.sign(
    {userId},
    JWT_SECRET,
    {expiresIn: JWT_EXPIRES_IN}
  )
}

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация. Токен не представлен'
      });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false, 
        message: 'Токен истек. Войдите заново'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false, 
        message: 'Неверный токен авторизации'
      });
    }
    
    return res.status(401).json({
      success: false, 
      message: 'Ошибка авторизации'
    });
  }
}