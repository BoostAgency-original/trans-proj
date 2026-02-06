import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/users';
import { subscriptionRoutes } from './routes/subscriptions';
import { messageRoutes } from './routes/messages';
import { settingsRoutes } from './routes/settings';
import { diaryRoutes } from './routes/diary';
import { principleRoutes } from './routes/principles';
import { authRoutes } from './routes/auth';
import { broadcastRoutes } from './routes/broadcasts';
import { cryptoPayWebhookRoutes } from './routes/crypto-pay-webhook';
import { authMiddleware } from './middleware/authMiddleware';

dotenv.config();

// Добавляем поддержку BigInt в JSON
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function() {
  return this.toString();
};

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Public Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/crypto-pay/webhook', cryptoPayWebhookRoutes); // Crypto Pay webhook (public, no auth)

// Protected Routes Middleware
app.use('/api', authMiddleware);

// Protected Routes
app.use('/api/users', userRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/principles', principleRoutes);
app.use('/api/broadcasts', broadcastRoutes);

app.listen(PORT, () => {
  console.log(`🚀 API server запущен на порту ${PORT}`);
});
