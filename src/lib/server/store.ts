// In-memory store. One Node process, three arrays. State resets on restart —
// fine for a prototype, and it means the demo runs with zero setup.
//
// The three arrays roughly correspond to the three tables we had before:
//   listings         seeded events
//   sessions         checkout sessions
//   completions      one row per completed order (uniqueness enforced in
//                    the checkout service; a real DB would UNIQUE(session_id))

import { randomUUID } from 'crypto';
import type { SessionStatus } from '$lib/shared/types';

export interface ListingRow {
	id: string;
	eventName: string;
	venue: string;
	eventStartsAt: string;
	priceCents: number;
}

export interface CheckoutSessionRow {
	id: string;
	listingId: string;
	status: SessionStatus;
	priceSnapshotCents: number;
	inventoryHoldUntil: string;
	completionKey: string | null;
	forcePaymentFail: boolean;
	failureReason: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
}

export interface CompletionRow {
	sessionId: string;
	orderId: string;
	completedAt: string;
}

export interface Store {
	listings: ListingRow[];
	sessions: CheckoutSessionRow[];
	completions: CompletionRow[];
}

export function makeStore(): Store {
	return {
		listings: [],
		sessions: [],
		completions: []
	};
}

// Seed a store with a fixed set of listings. Extract so tests can seed
// their own store with whatever they need.
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

export const DEFAULT_SEED: Omit<ListingRow, 'id'>[] = [
	{
		eventName: 'Warriors vs. Lakers',
		venue: 'Chase Center',
		eventStartsAt: days(3),
		priceCents: 18500
	},
	{
		eventName: 'Taylor Swift — Eras Tour',
		venue: 'Levi’s Stadium',
		eventStartsAt: days(10),
		priceCents: 42000
	},
	{
		eventName: 'Giants vs. Dodgers',
		venue: 'Oracle Park',
		eventStartsAt: days(5),
		priceCents: 8500
	}
];

export function seedListings(store: Store, rows: Omit<ListingRow, 'id'>[] = DEFAULT_SEED) {
	for (const row of rows) {
		const id = randomUUID();
		store.listings.push({ id, ...row });
	}
}

// Singleton for the running app. Tests DON'T import this — they call
// makeStore() themselves and pass it into their harness.
export const store = makeStore();
seedListings(store);
