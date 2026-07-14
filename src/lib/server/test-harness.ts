// Fresh in-memory store + wired-up checkout service per test.

import { randomUUID } from 'crypto';
import { makeStore, type Store, type ListingRow } from './store';
import { makeCheckoutService } from './services/checkout';
import { makePricingService } from './services/pricing';
import { makeInventoryService } from './services/inventory';
import { makePaymentService } from './services/payment';

export interface TestClock {
	now(): string;
	advance(ms: number): void;
	set(iso: string): void;
}

function makeClock(startIso = '2026-07-12T12:00:00.000Z'): TestClock {
	let current = Date.parse(startIso);
	return {
		now: () => new Date(current).toISOString(),
		advance: (ms) => {
			current += ms;
		},
		set: (iso) => {
			current = Date.parse(iso);
		}
	};
}

export function bootTestHarness() {
	const store: Store = makeStore();
	const clock = makeClock();
	const pricing = makePricingService(store);
	const checkout = makeCheckoutService({
		store,
		pricing,
		inventory: makeInventoryService(),
		payment: makePaymentService(),
		now: () => clock.now()
	});

	function seedListing(overrides?: Partial<{ eventName: string; priceCents: number }>): ListingRow {
		const row: ListingRow = {
			id: randomUUID(),
			eventName: overrides?.eventName ?? 'Test Event',
			venue: 'Test Venue',
			eventStartsAt: new Date(Date.parse(clock.now()) + 24 * 60 * 60 * 1000).toISOString(),
			priceCents: overrides?.priceCents ?? 10000
		};
		store.listings.push(row);
		return row;
	}

	return { store, checkout, pricing, clock, seedListing };
}
