import type { PageServerLoad } from './$types';
import { checkout } from '$lib/server/checkout';
import { error } from '@sveltejs/kit';
import { NotFoundError } from '$lib/server/services/checkout';

/**
 * SSR loader. Runs on every request, including the very first byte the fan
 * sees. The returned `session` is inlined into the HTML shell so the header,
 * price, and timer are all rendered before any JS executes.
 */
export const load: PageServerLoad = async ({ params }) => {
	try {
		const session = await checkout.resumeSession(params.sessionId);
		return { session };
	} catch (e) {
		if (e instanceof NotFoundError) throw error(404, 'Checkout session not found');
		throw e;
	}
};
