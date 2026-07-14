<script lang="ts">
	// SSR renders event/price/timer/CTA from `initial`. Client hydrates the
	// countdown and the poll refresh.
	import { onMount } from 'svelte';
	import { pollOnFocus } from '$lib/client/pollOnFocus';
	import { formatMoney, formatEventDate, formatMmSs } from '$lib/shared/format';
	import type { ResumedSession } from '$lib/shared/types';

	interface Props {
		initial: ResumedSession;
	}
	let { initial }: Props = $props();

	// NOTE: $state, not $derived — pollOnFocus and complete() reassign these.
	// A $derived can't be assigned to, so making these derived crashes the
	// first time the poll returns.
	let session = $state(initial);
	let secondsLeft = $state(initial.secondsLeft);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let orderId = $state<string | null>(null);

	onMount(() => {
		const poll = pollOnFocus(session.id, (fresh) => {
			session = fresh;
			secondsLeft = fresh.secondsLeft;
		});
		const tick = setInterval(() => {
			secondsLeft = Math.max(0, secondsLeft - 1);
		}, 1000);
		return () => {
			poll.stop();
			clearInterval(tick);
		};
	});

	async function refresh() {
		const r = await fetch(`/api/checkout/${session.id}`);
		if (r.ok) session = await r.json();
	}

	async function complete() {
		submitting = true;
		error = null;
		try {
			const r = await fetch(`/api/checkout/${session.id}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ acceptedPriceCents: session.currentPriceCents })
			});
			const body = await r.json();
			if (!r.ok) {
				error = body.error ?? 'Something went wrong';
				await refresh();
			} else {
				orderId = body.orderId;
				session = { ...session, status: 'completed' };
			}
		} finally {
			submitting = false;
		}
	}

	// dev helpers
	async function devExpire() {
		await fetch(`/api/dev/expire/${session.id}`, { method: 'POST' });
		await refresh();
	}
	async function devBump() {
		await fetch(`/api/dev/bump-price/${session.listing.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ priceCents: session.currentPriceCents + 500 })
		});
		await refresh();
	}
	async function devFail() {
		await fetch(`/api/dev/fail-next-payment/${session.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ value: true })
		});
		await refresh();
	}

	const isBlocked = $derived(
		session.status === 'expired' || session.status === 'completed' || secondsLeft <= 0
	);
</script>

<div class="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
	<header class="card">
		<div class="eyebrow">{session.listing.venue}</div>
		<h1 class="mt-1 text-xl font-semibold text-neutral-900">{session.listing.eventName}</h1>
		<div class="mt-1 text-sm text-neutral-600">
			{formatEventDate(session.listing.eventStartsAt)}
		</div>
	</header>

	<section class="card">
		<div class="flex items-baseline justify-between">
			<span class="text-sm text-neutral-600">Order total</span>
			<span class="text-2xl font-semibold tabular-nums text-neutral-900">
				{formatMoney(session.currentPriceCents)}
			</span>
		</div>

		{#if session.priceChanged}
			<div class="card-warning mt-3">
				<div class="font-medium">Price changed while you were away</div>
				<div class="mt-1 text-amber-800">
					You saw <span class="line-through">{formatMoney(session.priceSnapshotCents)}</span>, it's
					now <strong>{formatMoney(session.currentPriceCents)}</strong>. Tap Confirm to accept the
					new price.
				</div>
			</div>
		{/if}

		<div class="mt-4 flex items-center justify-between text-sm text-neutral-600">
			<span>Time to complete</span>
			<span
				class="tabular-nums font-medium"
				class:text-red-600={secondsLeft <= 30}
				class:text-neutral-700={secondsLeft > 30}
			>
				{formatMmSs(secondsLeft)}
			</span>
		</div>
	</section>

	{#if session.status === 'completed' || orderId}
		<div class="card-success">
			<div class="text-sm font-medium">Order confirmed</div>
			{#if orderId}<div class="mt-1 text-xs">Order id: {orderId}</div>{/if}
			<div class="mt-1 text-xs">Click Confirm again — same order id.</div>
		</div>
	{:else if session.status === 'expired'}
		<div class="card-error">
			<div class="text-sm font-medium">Session expired</div>
			<div class="mt-1 text-xs">The inventory hold lapsed. Head back and pick again.</div>
		</div>
	{:else if session.status === 'failed'}
		<div class="card-error">
			<div class="text-sm font-medium">Payment failed: {session.failureReason ?? 'unknown'}</div>
			<div class="mt-1 text-xs">Tap Confirm to try again.</div>
		</div>
	{/if}

	{#if error}
		<div class="alert-error">{error}</div>
	{/if}

	<button onclick={complete} disabled={submitting || isBlocked} class="btn-primary">
		{#if submitting}
			Processing…
		{:else if session.status === 'completed'}
			Completed
		{:else if session.status === 'expired'}
			Expired
		{:else if session.priceChanged}
			Confirm at {formatMoney(session.currentPriceCents)}
		{:else}
			Confirm purchase
		{/if}
	</button>

	<div class="card-dev">
		<div class="mb-2 font-semibold text-neutral-700">Dev controls</div>
		<div class="flex flex-wrap gap-2">
			<button class="btn-outline" onclick={devExpire}>Expire hold</button>
			<button class="btn-outline" onclick={devBump}>Bump price +$5</button>
			<button class="btn-outline" onclick={devFail}>Fail next payment</button>
		</div>
	</div>
</div>
