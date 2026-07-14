// Single wired-up checkout service for the app. Import `checkout` from here.

import { store } from './store';
import { makeCheckoutService } from './services/checkout';
import { makePricingService } from './services/pricing';
import { makeInventoryService } from './services/inventory';
import { makePaymentService } from './services/payment';

export const checkout = makeCheckoutService({
	store,
	pricing: makePricingService(store),
	inventory: makeInventoryService(),
	payment: makePaymentService()
});
