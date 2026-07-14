// Refetches the session on visibilitychange, focus, and every `intervalMs`
// while visible. This is how the two surfaces stay roughly in sync — cheaper
// than SSE and mobile-lifecycle-friendly.

import type { ResumedSession } from '$lib/shared/types';

export interface PollHandle {
	stop(): void;
}

export function pollOnFocus(
	sessionId: string,
	onUpdate: (s: ResumedSession) => void,
	intervalMs = 15_000
): PollHandle {
	let stopped = false;
	let timer: ReturnType<typeof setInterval> | null = null;

	async function refetch() {
		if (stopped) return;
		try {
			const r = await fetch(`/api/checkout/${sessionId}`, {
				headers: { accept: 'application/json' }
			});
			if (!r.ok) return;
			const data = (await r.json()) as ResumedSession;
			if (!stopped) onUpdate(data);
		} catch {
			// transient — try again next tick
		}
	}

	function onVisible() {
		if (document.visibilityState === 'visible') refetch();
	}

	refetch();
	timer = setInterval(refetch, intervalMs);
	document.addEventListener('visibilitychange', onVisible);
	window.addEventListener('focus', refetch);

	return {
		stop() {
			stopped = true;
			if (timer) clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', refetch);
		}
	};
}
