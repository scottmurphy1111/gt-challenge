// Shared types. Wire shapes come across at the top; DB row shape below.

export const SESSION_STATUSES = ['active', 'completing', 'completed', 'failed', 'expired'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const TERMINAL_STATUSES = new Set<SessionStatus>(['completed', 'expired']);

export interface Listing {
	id: string;
	eventName: string;
	venue: string;
	eventStartsAt: string;
	priceCents: number;
}

// Shape returned by GET /api/checkout/[id] and POST /api/checkout.
export interface ResumedSession {
	id: string;
	listingId: string;
	status: SessionStatus;
	priceSnapshotCents: number;
	currentPriceCents: number;
	priceChanged: boolean;
	inventoryHoldUntil: string;
	secondsLeft: number;
	completionKey: string | null;
	failureReason: string | null;
	listing: Listing;
}

export interface CompletionResult {
	sessionId: string;
	orderId: string;
	completedAt: string;
}

// Only used server-side; kept here to avoid a second types file.
export interface CheckoutSessionRecord {
	id: string;
	listingId: string;
	status: SessionStatus;
	priceSnapshotCents: number;
	inventoryHoldUntil: string;
	completionKey: string | null;
	failureReason: string | null;
	forcePaymentFail: boolean;
	version: number;
	createdAt: string;
	updatedAt: string;
}
