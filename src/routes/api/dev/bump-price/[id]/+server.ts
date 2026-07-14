import type { RequestHandler } from './$types';
import { checkout } from '$lib/server/checkout';
import { errorResponse, readJson } from '$lib/server/api-helpers';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await readJson<{ priceCents?: number }>(request);
		if (typeof body.priceCents !== 'number') {
			return Response.json({ error: 'priceCents required' }, { status: 400 });
		}
		await checkout.bumpPrice(params.id, body.priceCents);
		return Response.json({ ok: true });
	} catch (err) {
		return errorResponse(err);
	}
};
