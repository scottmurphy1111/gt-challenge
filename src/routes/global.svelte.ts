// Which surface am I on? Derived from the URL, not stored.
//
// Only safe to READ from component render code — `page` from `$app/state` is
// per-request context, so reading it at module scope would either error
// (SSR) or leak one user's URL to another. Getters push the read to render
// time, where it lives.

import { page } from '$app/state';

export const global = {
	get isWeb() {
		return page.url.pathname.startsWith('/checkout/');
	},
	get isMobile() {
		return page.url.pathname.startsWith('/m/');
	}
};
