import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
    process.env.JWT_SECRET,
    {expiresIn: process.env.JWT_EXPIRES_IN}
  )
}

export const generateTokenRemember = userId => {
  return jwt.sign(
    {userId},
    process.env.JWT_SECRET_REMEMBER,
    {expiresIn: process.env.JWT_REMEMBER_TOKEN}
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

export const rememberMiddleware  = (req, res, next) => {
  const {token} = req.body;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: `Требуется refresh token ${token}` 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_REMEMBER);
    console.log(decoded)
    console.log(token)
    console.log(process.env.JWT_SECRET_REMEMBER)
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Неверный или истёкший refresh token' 
    });
  }
}   

