// Checkout service. Handles create / resume / complete.
//
// The idempotency guarantee: JS is single-threaded, so a sync check-and-set
// of session.completionKey is atomic. As long as there's no `await` between
// reading status and writing the completion key, two concurrent completes
// can't both win. See the "race" test.

import { randomUUID } from 'crypto';
import type { Store, CheckoutSessionRow } from '../store';
import { assertTransition } from '../state-machine';
import type { PricingService } from './pricing';
import { DEFAULT_HOLD_DURATION_MS, type InventoryService } from './inventory';
import type { PaymentService } from './payment';
import type { ResumedSession } from '$lib/shared/types';

export class NotFoundError extends Error {
	constructor(what: string) {
		super(`${what} not found`);
		this.name = 'NotFoundError';
	}
}

type ConflictKind = 'price_changed' | 'expired' | 'in_progress' | 'payment_failed' | 'terminal';

export class ConflictError extends Error {
	constructor(
		message: string,
		public readonly kind: ConflictKind
	) {
		super(message);
		this.name = 'ConflictError';
	}
}

export interface CheckoutDeps {
	store: Store;
	pricing: PricingService;
	inventory: InventoryService;
	payment: PaymentService;
	now?: () => string; // for tests
}

export function makeCheckoutService(deps: CheckoutDeps) {
	const { store, pricing, inventory, payment } = deps;
	const now = deps.now ?? (() => new Date().toISOString());

	function getSession(id: string): CheckoutSessionRow {
		const row = store.sessions.find((session) => session.id === id);
		if (!row) throw new NotFoundError('Checkout session');
		return row;
	}

	function getListing(id: string) {
		const row = store.listings.find((listing) => listing.id === id);
		if (!row) throw new NotFoundError('Listing');
		return row;
	}

	// Project the row to the wire shape. Runs the lazy active -> expired
	// transition if the hold has lapsed.
	function project(row: CheckoutSessionRow): ResumedSession {
		const listing = getListing(row.listingId);
		const nowMs = Date.parse(now());
		const holdMs = Date.parse(row.inventoryHoldUntil);

		if (row.status === 'active' && holdMs <= nowMs) {
			assertTransition('active', 'expired');
			row.status = 'expired';
			row.updatedAt = now();
			row.version += 1;
		}

		return {
			id: row.id,
			listingId: row.listingId,
			status: row.status,
			priceSnapshotCents: row.priceSnapshotCents,
			currentPriceCents: listing.priceCents,
			priceChanged: row.status === 'active' && listing.priceCents !== row.priceSnapshotCents,
			inventoryHoldUntil: row.inventoryHoldUntil,
			secondsLeft: Math.max(0, Math.floor((holdMs - nowMs) / 1000)),
			completionKey: row.completionKey,
			failureReason: row.failureReason,
			listing: {
				id: listing.id,
				eventName: listing.eventName,
				venue: listing.venue,
				eventStartsAt: listing.eventStartsAt,
				priceCents: listing.priceCents
			}
		};
	}

	async function createSession(input: { listingId: string; holdDurationMs?: number }) {
		const listing = getListing(input.listingId);
		const hold = await inventory.tryHold({
			listingId: input.listingId,
			durationMs: input.holdDurationMs ?? DEFAULT_HOLD_DURATION_MS
		});
		if (!hold.ok) throw new ConflictError(`Cannot hold inventory: ${hold.reason}`, 'expired');

		const t = now();
		const row: CheckoutSessionRow = {
			id: randomUUID(),
			listingId: input.listingId,
			status: 'active',
			priceSnapshotCents: listing.priceCents,
			inventoryHoldUntil: hold.holdUntil,
			completionKey: null,
			forcePaymentFail: false,
			failureReason: null,
			version: 0,
			createdAt: t,
			updatedAt: t
		};
		store.sessions.push(row);
		return project(row);
	}

	async function resumeSession(sessionId: string) {
		return project(getSession(sessionId));
	}

	async function completeSession(input: { sessionId: string; acceptedPriceCents: number }) {
		const { sessionId, acceptedPriceCents } = input;

		// --- SYNC critical section starts here ---
		// No `await`s between this and the completionKey assignment below.
		const row = getSession(sessionId);

		if (row.status === 'completed') {
			const existing = store.completions.find((c) => c.sessionId === sessionId);
			if (existing) {
				return {
					sessionId,
					orderId: existing.orderId,
					completedAt: existing.completedAt
				};
			}
			throw new ConflictError('Session marked completed but no order recorded', 'in_progress');
		}

		if (row.status === 'expired') throw new ConflictError('Session expired', 'expired');

		// Retry after failure — flip failed back to active if hold's still valid.
		if (row.status === 'failed') {
			if (Date.parse(row.inventoryHoldUntil) <= Date.parse(now())) {
				throw new ConflictError('Session expired', 'expired');
			}
			row.status = 'active';
			row.failureReason = null;
			row.completionKey = null;
			row.updatedAt = now();
			row.version += 1;
		}

		const listing = getListing(row.listingId);
		if (acceptedPriceCents !== listing.priceCents) {
			throw new ConflictError(
				`Price changed. Accepted ${acceptedPriceCents}, current ${listing.priceCents}`,
				'price_changed'
			);
		}

		// The idempotency lock. Sync check-and-set — atomic under JS's
		// single-threaded model. If we didn't win, bail before touching payment.
		if (row.status !== 'active' || row.completionKey !== null) {
			const done = store.completions.find((c) => c.sessionId === sessionId);
			if (done) return { sessionId, orderId: done.orderId, completedAt: done.completedAt };
			throw new ConflictError('Completion already in progress on another device', 'in_progress');
		}
		row.status = 'completing';
		row.completionKey = randomUUID();
		row.updatedAt = now();
		row.version += 1;
		const forceFail = row.forcePaymentFail;
		// --- SYNC critical section ends here ---

		const paid = await payment.authorizeAndCapture({
			sessionId,
			amountCents: listing.priceCents,
			forceFail
		});

		if (!paid.ok) {
			assertTransition('completing', 'failed');
			row.status = 'failed';
			row.failureReason = paid.reason;
			row.completionKey = null;
			row.forcePaymentFail = false;
			row.updatedAt = now();
			row.version += 1;
			throw new ConflictError(`Payment failed: ${paid.reason}`, 'payment_failed');
		}

		// Belt AND suspenders. In a real DB this is UNIQUE(session_id); here
		// it's a manual .find guard before push. Arrays don't enforce
		// uniqueness on their own, so if this check ever disappears a bug
		// upstream could accumulate duplicate completion rows.
		const already = store.completions.find((c) => c.sessionId === sessionId);
		if (already) {
			return { sessionId, orderId: already.orderId, completedAt: already.completedAt };
		}
		const completion = {
			sessionId,
			orderId: paid.orderId,
			completedAt: now()
		};
		store.completions.push(completion);

		assertTransition('completing', 'completed');
		row.status = 'completed';
		row.updatedAt = now();
		row.version += 1;

		return completion;
	}

	// dev routes

	async function forceExpire(sessionId: string) {
		const row = getSession(sessionId);
		row.inventoryHoldUntil = new Date(Date.now() - 1000).toISOString();
		row.updatedAt = now();
		row.version += 1;
		return resumeSession(sessionId);
	}

	async function setForcePaymentFail(sessionId: string, value: boolean) {
		const row = getSession(sessionId);
		row.forcePaymentFail = value;
		row.updatedAt = now();
		row.version += 1;
		return resumeSession(sessionId);
	}

	async function bumpPrice(listingId: string, newPriceCents: number) {
		await pricing.bumpPrice(listingId, newPriceCents);
	}

	return {
		createSession,
		resumeSession,
		completeSession,
		forceExpire,
		setForcePaymentFail,
		bumpPrice
	};
}

export type CheckoutService = ReturnType<typeof makeCheckoutService>;
