import type { RequestHandler } from './$types';
import { checkout } from '$lib/server/checkout';
import { errorResponse } from '$lib/server/api-helpers';

export const POST: RequestHandler = async ({ params }) => {
	try {
		return Response.json(await checkout.forceExpire(params.id));
	} catch (err) {
		return errorResponse(err);
	}
};
