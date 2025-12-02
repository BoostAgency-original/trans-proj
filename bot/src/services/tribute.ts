const TRIBUTE_API_URL = 'https://tribute.tg/api/v1';

export interface CreateOrderParams {
    amount: number; // in kopecks/cents
    currency: 'rub' | 'eur'; // Tribute docs say 'rub' or 'eur'
    title: string;
    description: string;
    returnUrl?: string; // successUrl
    failUrl?: string;
    email?: string;
}

export interface TributeOrder {
    uuid: string;
    paymentUrl: string;
}

export interface OrderStatus {
    status: 'paid' | 'created' | 'canceled' | 'failed' | 'new'; // Adjust based on actual API response
}

export class TributeService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey.trim(); // Удаляем возможные пробелы
        if (this.apiKey) {
            console.log(`Tribute Service initialized with Key: ${this.apiKey.substring(0, 5)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
        } else {
            console.error('❌ Tribute API Key is missing or empty!');
        }
    }

    async createOrder(params: CreateOrderParams): Promise<TributeOrder> {
        try {
            const response = await fetch(`${TRIBUTE_API_URL}/shop/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': this.apiKey
                },
                body: JSON.stringify({
                    amount: params.amount,
                    currency: params.currency,
                    title: params.title,
                    description: params.description,
                    successUrl: params.returnUrl,
                    failUrl: params.failUrl,
                    email: params.email
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Tribute API Error (Create):', errorText);
                throw new Error(`Tribute API error: ${response.statusText}`);
            }

            return await response.json() as TributeOrder;
        } catch (error) {
            console.error('Error creating Tribute order:', error);
            throw error;
        }
    }

    async getOrderStatus(orderUuid: string): Promise<OrderStatus> {
        try {
            const response = await fetch(`${TRIBUTE_API_URL}/shop/orders/${orderUuid}/status`, {
                method: 'GET',
                headers: {
                    'Api-Key': this.apiKey
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Tribute API Error (Status):', errorText);
                throw new Error(`Tribute API error: ${response.statusText}`);
            }

            return await response.json() as OrderStatus;
        } catch (error) {
            console.error('Error checking Tribute order status:', error);
            throw error;
        }
    }
}

export const tributeService = new TributeService(process.env.TRIBUTE_API_KEY || '');
