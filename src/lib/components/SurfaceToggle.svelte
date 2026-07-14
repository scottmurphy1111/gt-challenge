<script lang="ts">
	// Two-segment toggle that navigates between the /checkout and /m surfaces
	// for the same session. Uses <a href> instead of goto() so it works
	// without JS and preloads on hover for free.
	import { global } from '../../routes/global.svelte';

	interface Props {
		sessionId: string;
	}
	let { sessionId }: Props = $props();
</script>

<div class="segmented" role="tablist" aria-label="Surface">
	<a
		role="tab"
		aria-selected={global.isWeb}
		class="segment"
		class:segment-active={global.isWeb}
		href={`/checkout/${sessionId}`}
	>
		Web
	</a>
	<a
		role="tab"
		aria-selected={global.isMobile}
		class="segment"
		class:segment-active={global.isMobile}
		href={`/m/${sessionId}`}
	>
		Mobile
	</a>
</div>
