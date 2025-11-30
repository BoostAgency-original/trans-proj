import { Router } from 'express';
import { authService } from '../services/authService';

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const token = authService.validateCredentials(username, password);

  if (!token) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ token });
});

authRoutes.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    authService.logout(token);
  }
  res.json({ success: true });
});

authRoutes.get('/check', (req, res) => {
  // Если запрос дошел сюда через middleware, значит токен валиден
  res.json({ authenticated: true });
});

