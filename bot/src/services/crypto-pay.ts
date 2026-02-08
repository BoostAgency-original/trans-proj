// Crypto Pay API (Crypto Bot) — https://help.send.tg/en/articles/10279948-crypto-pay-api
// Testnet: https://testnet-pay.crypt.bot/
// Mainnet: https://pay.crypt.bot/

const CRYPTO_PAY_API_URL = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
const CRYPTO_PAY_TOKEN = process.env.CRYPTO_PAY_API_TOKEN || '';

interface CryptoPayInvoice {
  invoice_id: number;
  hash: string;
  currency_type: string;
  amount: string;
  bot_invoice_url: string;
  mini_app_invoice_url: string;
  web_app_invoice_url: string;
  status: 'active' | 'paid' | 'expired';
  description?: string;
  payload?: string;
  created_at: string;
}

interface CryptoPayResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

async function cryptoPayRequest<T>(method: string, params?: Record<string, any>): Promise<T> {
  const url = `${CRYPTO_PAY_API_URL}/${method}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Crypto-Pay-API-Token': CRYPTO_PAY_TOKEN,
    },
    body: params ? JSON.stringify(params) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CryptoPay] API Error (${method}):`, errorText);
    throw new Error(`CryptoPay API error: ${response.statusText}`);
  }

  const data = (await response.json()) as CryptoPayResponse<T>;

  if (!data.ok) {
    console.error(`[CryptoPay] Error (${method}):`, data.error);
    throw new Error(`CryptoPay error: ${data.error}`);
  }

  return data.result!;
}

/**
 * Создаём инвойс для оплаты криптой.
 * currency_type=fiat позволяет указать сумму в рублях, а пользователь заплатит криптой.
 */
export async function createCryptoInvoice(opts: {
  amountRub: number; // сумма в рублях (не копейках!)
  description: string;
  payload: string; // JSON с данными (userId, planId, type, etc.)
  botUsername?: string; // для кнопки "Вернуться в бот"
}): Promise<{ invoiceId: number; payUrl: string; miniAppUrl: string }> {
  const params: Record<string, any> = {
    currency_type: 'fiat',
    fiat: 'RUB',
    amount: opts.amountRub.toFixed(2),
    description: opts.description,
    payload: opts.payload,
    paid_btn_name: 'callback',
    paid_btn_url: opts.botUsername ? `https://t.me/${opts.botUsername.replace('@', '')}` : 'https://t.me',
  };

  const invoice = await cryptoPayRequest<CryptoPayInvoice>('createInvoice', params);

  console.log(`[CryptoPay] Invoice created: id=${invoice.invoice_id}, url=${invoice.bot_invoice_url}`);

  return {
    invoiceId: invoice.invoice_id,
    payUrl: invoice.bot_invoice_url,
    miniAppUrl: invoice.mini_app_invoice_url,
  };
}

export async function testConnection(): Promise<boolean> {
  try {
    const result = await cryptoPayRequest<any>('getMe');
    console.log(`[CryptoPay] Connected: app_id=${result.app_id}, name=${result.name}`);
    return true;
  } catch {
    console.error('[CryptoPay] Connection test failed');
    return false;
  }
}
