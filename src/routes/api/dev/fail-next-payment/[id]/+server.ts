import type { RequestHandler } from './$types';
import { checkout } from '$lib/server/checkout';
import { errorResponse, readJson } from '$lib/server/api-helpers';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await readJson<{ value?: boolean }>(request);
		const s = await checkout.setForcePaymentFail(params.id, body.value ?? true);
		return Response.json(s);
	} catch (err) {
		return errorResponse(err);
	}
};
