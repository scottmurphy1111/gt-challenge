import type { PageServerLoad } from './$types';
import { checkout } from '$lib/server/checkout';
import { error } from '@sveltejs/kit';
import { NotFoundError } from '$lib/server/services/checkout';

/**
 * Mobile deep-link entry point. Uses the same loader as the web route —
 * one session, one state model, two surfaces.
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
