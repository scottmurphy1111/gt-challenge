// Inventory stub. Real impl would decrement a counter with row-level
// locking or call a supplier API. For the take-home, tryHold always says yes
// and the "did the hold expire?" question is answered by comparing
// session.inventoryHoldUntil to now, not by asking this service.

export interface HoldResult {
	ok: true;
	holdUntil: string;
}

export interface HoldFailure {
	ok: false;
	reason: 'sold_out' | 'listing_missing';
}

export interface InventoryService {
	tryHold(input: { listingId: string; durationMs: number }): Promise<HoldResult | HoldFailure>;
	release(sessionId: string): Promise<void>;
}

// 3 minutes. Short enough to demo an expiration in real time.
export const DEFAULT_HOLD_DURATION_MS = 3 * 60 * 1000;

export function makeInventoryService(): InventoryService {
	return {
		async tryHold({ durationMs }) {
			return { ok: true, holdUntil: new Date(Date.now() + durationMs).toISOString() };
		},
		async release() {
			// no-op
		}
	};
}
