// Pricing — reads / writes the listing price on the in-memory store.

import type { Store } from '../store';

export interface PricingService {
	currentPrice(listingId: string): Promise<number>;
	bumpPrice(listingId: string, newPriceCents: number): Promise<void>;
}

export function makePricingService(store: Store): PricingService {
	return {
		async currentPrice(listingId) {
			const listing = store.listings.find((l) => l.id === listingId);
			if (!listing) throw new Error(`Listing ${listingId} not found`);
			return listing.priceCents;
		},

		async bumpPrice(listingId, newPriceCents) {
			const listing = store.listings.find((l) => l.id === listingId);
			if (!listing) throw new Error(`Listing ${listingId} not found`);
			listing.priceCents = newPriceCents;
		}
	};
}
