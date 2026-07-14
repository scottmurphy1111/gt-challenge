import { ConflictError, NotFoundError } from './services/checkout';

export function errorResponse(err: unknown) {
	if (err instanceof NotFoundError) {
		return Response.json({ error: err.message }, { status: 404 });
	}
	if (err instanceof ConflictError) {
		return Response.json({ error: err.message, kind: err.kind }, { status: 409 });
	}
	console.error('unhandled api error', err);
	return Response.json({ error: 'Internal error' }, { status: 500 });
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T;
	} catch {
		return {} as T;
	}
}
