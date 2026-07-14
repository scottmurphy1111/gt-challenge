// Payment stub. Real impl calls Stripe / Adyen / whatever.

export interface PaymentSuccess {
	ok: true;
	orderId: string;
}
export interface PaymentFailure {
	ok: false;
	reason: 'card_declined' | 'network_error' | 'auth_expired';
}

export interface PaymentService {
	authorizeAndCapture(input: {
		sessionId: string;
		amountCents: number;
		forceFail?: boolean;
	}): Promise<PaymentSuccess | PaymentFailure>;
}

export function makePaymentService(): PaymentService {
	return {
		async authorizeAndCapture({ sessionId, forceFail }) {
			if (forceFail) return { ok: false, reason: 'card_declined' };
			return {
				ok: true,
				orderId: `ord_${sessionId.slice(0, 8)}_${Date.now().toString(36)}`
			};
		}
	};
}
