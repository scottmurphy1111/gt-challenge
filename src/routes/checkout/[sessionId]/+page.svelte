<script lang="ts">
	import CheckoutShell from '$lib/components/CheckoutShell.svelte';
	import SurfaceToggle from '$lib/components/SurfaceToggle.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Checkout · {data.session.listing.eventName}</title>
</svelte:head>

<main class="min-h-screen bg-neutral-100 py-8">
	<div class="mx-auto max-w-md">
		<div class="mb-4 flex items-center justify-between px-4">
			<a href="/" class="text-sm text-neutral-600 hover:text-neutral-900">← Listings</a>
			<SurfaceToggle sessionId={data.session.id} />
		</div>
		<CheckoutShell initial={data.session} />
	</div>
</main>
