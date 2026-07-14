import type { PageServerLoad } from './$types';
import { store } from '$lib/server/store';

export const load: PageServerLoad = async () => {
	// slice before sort — .sort() mutates, and store.listings is shared state
	const listings = store.listings
		.slice()
		.sort((a, b) => a.eventStartsAt.localeCompare(b.eventStartsAt));
	return { listings };
};
