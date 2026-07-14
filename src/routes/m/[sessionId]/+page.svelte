<script lang="ts">
	import CheckoutShell from '$lib/components/CheckoutShell.svelte';
	import SurfaceToggle from '$lib/components/SurfaceToggle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Gametime · Checkout</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
</svelte:head>

<!-- Same loader as /checkout/[sessionId], different chrome. -->
<main class="min-h-screen bg-neutral-100">
	<div class="mx-auto max-w-sm">
		<div class="flex items-center justify-between px-4 pt-4">
			<span class="text-sm font-semibold text-neutral-900">Gametime</span>
			<SurfaceToggle sessionId={data.session.id} />
		</div>
		<CheckoutShell initial={data.session} />
	</div>
</main>
