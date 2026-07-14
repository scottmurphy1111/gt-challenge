import type { RequestHandler } from './$types';
import { checkout } from '$lib/server/checkout';
import { errorResponse, readJson } from '$lib/server/api-helpers';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await readJson<{ acceptedPriceCents?: number }>(request);
		if (typeof body.acceptedPriceCents !== 'number') {
			return Response.json({ error: 'acceptedPriceCents required' }, { status: 400 });
		}
		const result = await checkout.completeSession({
			sessionId: params.id,
			acceptedPriceCents: body.acceptedPriceCents
		});
		return Response.json(result);
	} catch (err) {
		return errorResponse(err);
	}
};
