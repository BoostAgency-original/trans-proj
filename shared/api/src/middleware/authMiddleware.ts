import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Пропускаем проверку для OPTIONS запросов (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid authorization format' });
  }

  if (!authService.isValidToken(token)) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  next();
};

