import type { RequestHandler } from './$types';
import { checkout } from '$lib/server/checkout';
import { errorResponse, readJson } from '$lib/server/api-helpers';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await readJson<{ listingId?: string }>(request);
		if (!body.listingId) return Response.json({ error: 'listingId required' }, { status: 400 });
		const session = await checkout.createSession({ listingId: body.listingId });
		return Response.json(session, { status: 201 });
	} catch (err) {
		return errorResponse(err);
	}
};
