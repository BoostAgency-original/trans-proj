import crypto from 'crypto';

// Генерируем случайный пароль при запуске
const generatePassword = () => {
  return crypto.randomBytes(6).toString('hex'); // 12 символов
};

const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

class AuthService {
  private username = 'admin';
  private password = process.env.ADMIN_PASSWORD || generatePassword();
  private validTokens = new Set<string>();

  constructor() {
    console.log('\n==================================================');
    console.log('🔐 ADMIN PANEL CREDENTIALS');
    console.log(`👤 Username: ${this.username}`);
    console.log(`🔑 Password: ${this.password}`);
    console.log('==================================================\n');
  }

  validateCredentials(username: string, pass: string): string | null {
    if (username === this.username && pass === this.password) {
      const token = generateToken();
      this.validTokens.add(token);
      return token;
    }
    return null;
  }

  isValidToken(token: string): boolean {
    return this.validTokens.has(token);
  }

  logout(token: string) {
    this.validTokens.delete(token);
  }
}

export const authService = new AuthService();

