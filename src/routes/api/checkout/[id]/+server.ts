import type { RequestHandler } from './$types';
import { checkout } from '$lib/server/checkout';
import { errorResponse } from '$lib/server/api-helpers';

export const GET: RequestHandler = async ({ params }) => {
	try {
		return Response.json(await checkout.resumeSession(params.id));
	} catch (err) {
		return errorResponse(err);
	}
};
