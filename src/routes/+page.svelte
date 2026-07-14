<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatMoney, formatEventDate } from '$lib/shared/format';
	import type { ResumedSession } from '$lib/shared/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let starting = $state<string | boolean>(false);

	const startCheckout = async (listingId: string) => {
		try {
			starting = listingId;
			const r = await fetch('/api/checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ listingId })
			});
			if (!r.ok) throw new Error(await r.text());
			const session = (await r.json()) as ResumedSession;
			await goto(`/checkout/${session.id}`);
		} finally {
			starting = false;
		}
	};
</script>

<main class="mx-auto max-w-2xl px-4 py-10">
	<h1 class="text-2xl font-semibold text-neutral-900">Available tickets</h1>
	<p class="mt-1 text-sm text-neutral-600">
		Pick a listing to start a checkout session. Use the dev controls on the checkout page to
		simulate expiration, price changes, and payment failures. Every session is resumable on
		<code class="rounded bg-neutral-200 px-1">/checkout/[id]</code> and
		<code class="rounded bg-neutral-200 px-1">/m/[id]</code>.
	</p>

	{#if data.listings.length === 0}
		<div class="card-dev mt-8 p-6 text-sm">
			No listings seeded. Restart the dev server to re-seed.
		</div>
	{/if}

	<ul class="mt-6 flex flex-col gap-3">
		{#each data.listings as listing (listing.id)}
			<li class="card flex items-center justify-between">
				<div>
					<div class="eyebrow">{listing.venue}</div>
					<div class="mt-0.5 text-base font-semibold text-neutral-900">{listing.eventName}</div>
					<div class="mt-0.5 text-sm text-neutral-600">
						{formatEventDate(listing.eventStartsAt)}
					</div>
				</div>
				<div class="flex flex-col items-end gap-2">
					<span class="text-lg font-semibold tabular-nums">{formatMoney(listing.priceCents)}</span>
					<button
						class="btn-pill"
						onclick={() => startCheckout(listing.id)}
						disabled={starting === listing.id}
					>
						{starting === listing.id ? 'Starting…' : 'Start checkout'}
					</button>
				</div>
			</li>
		{/each}
	</ul>
</main>
