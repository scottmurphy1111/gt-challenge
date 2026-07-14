import { describe, it, expect } from 'vitest';
import { bootTestHarness } from '../test-harness';

// Each test gets its own store — no cleanup needed.

describe('checkout continuity', () => {
	it('resumes across surfaces', async () => {
		const h = bootTestHarness();
		const listing = h.seedListing({ priceCents: 12000 });

		// mobile creates
		const created = await h.checkout.createSession({ listingId: listing.id });
		expect(created.status).toBe('active');
		expect(created.priceSnapshotCents).toBe(12000);

		// desktop resumes with just the id — same shape comes back
		const resumed = await h.checkout.resumeSession(created.id);
		expect(resumed.id).toBe(created.id);
		expect(resumed.status).toBe('active');
		expect(resumed.priceSnapshotCents).toBe(12000);
		expect(resumed.currentPriceCents).toBe(12000);
		expect(resumed.priceChanged).toBe(false);
		expect(resumed.secondsLeft).toBeGreaterThan(0);
	});

	it('lazily expires when the hold lapses', async () => {
		const h = bootTestHarness();
		const listing = h.seedListing();
		const s = await h.checkout.createSession({ listingId: listing.id });

		h.clock.advance(10 * 60 * 1000);

		const resumed = await h.checkout.resumeSession(s.id);
		expect(resumed.status).toBe('expired');
		expect(resumed.secondsLeft).toBe(0);
	});

	it('flags a price change and blocks completion at the stale price', async () => {
		const h = bootTestHarness();
		const listing = h.seedListing({ priceCents: 10000 });
		const s = await h.checkout.createSession({ listingId: listing.id });

		// price bump while the fan is away
		await h.checkout.bumpPrice(listing.id, 12500);

		const resumed = await h.checkout.resumeSession(s.id);
		expect(resumed.priceChanged).toBe(true);
		expect(resumed.priceSnapshotCents).toBe(10000);
		expect(resumed.currentPriceCents).toBe(12500);

		// stale price -> reject
		await expect(
			h.checkout.completeSession({ sessionId: s.id, acceptedPriceCents: 10000 })
		).rejects.toMatchObject({ name: 'ConflictError', kind: 'price_changed' });

		// new price -> succeeds
		const done = await h.checkout.completeSession({
			sessionId: s.id,
			acceptedPriceCents: 12500
		});
		expect(done.orderId).toBeTruthy();

		const after = await h.checkout.resumeSession(s.id);
		expect(after.status).toBe('completed');
	});

	it('produces exactly one order when two devices race the complete call', async () => {
		const h = bootTestHarness();
		const listing = h.seedListing({ priceCents: 15000 });
		const s = await h.checkout.createSession({ listingId: listing.id });

		const [a, b] = await Promise.allSettled([
			h.checkout.completeSession({ sessionId: s.id, acceptedPriceCents: 15000 }),
			h.checkout.completeSession({ sessionId: s.id, acceptedPriceCents: 15000 })
		]);

		// one succeeds; the other either loses cleanly or sees the idempotent success
		const ok = [a, b]
			.filter((r) => r.status === 'fulfilled')
			.map((r) => (r as PromiseFulfilledResult<{ orderId: string }>).value.orderId);

		expect(new Set(ok).size).toBe(1);

		// only one completion row exists
		expect(h.store.completions).toHaveLength(1);
		expect(h.store.completions[0].sessionId).toBe(s.id);
	});

	it('rejects completion after the hold expired', async () => {
		const h = bootTestHarness();
		const listing = h.seedListing();
		const s = await h.checkout.createSession({ listingId: listing.id });
		h.clock.advance(10 * 60 * 1000);
		await h.checkout.resumeSession(s.id); // triggers active -> expired

		await expect(
			h.checkout.completeSession({ sessionId: s.id, acceptedPriceCents: s.priceSnapshotCents })
		).rejects.toMatchObject({ name: 'ConflictError', kind: 'expired' });
	});

	it('allows retry after a payment failure', async () => {
		const h = bootTestHarness();
		const listing = h.seedListing({ priceCents: 9000 });
		const s = await h.checkout.createSession({ listingId: listing.id });

		await h.checkout.setForcePaymentFail(s.id, true);

		await expect(
			h.checkout.completeSession({ sessionId: s.id, acceptedPriceCents: 9000 })
		).rejects.toMatchObject({ name: 'ConflictError', kind: 'payment_failed' });

		const failed = await h.checkout.resumeSession(s.id);
		expect(failed.status).toBe('failed');
		expect(failed.failureReason).toBe('card_declined');

		// force-fail flag was cleared on failure, so retry should now succeed
		const done = await h.checkout.completeSession({
			sessionId: s.id,
			acceptedPriceCents: 9000
		});
		expect(done.orderId).toBeTruthy();
	});

	it('returns the same result on repeat complete after success (idempotent)', async () => {
		const h = bootTestHarness();
		const listing = h.seedListing();
		const s = await h.checkout.createSession({ listingId: listing.id });

		const first = await h.checkout.completeSession({
			sessionId: s.id,
			acceptedPriceCents: s.priceSnapshotCents
		});
		const second = await h.checkout.completeSession({
			sessionId: s.id,
			acceptedPriceCents: s.priceSnapshotCents
		});

		expect(second.orderId).toBe(first.orderId);
		expect(second.completedAt).toBe(first.completedAt);
	});
});
