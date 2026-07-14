export function formatMoney(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

export function formatEventDate(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

export function formatMmSs(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const mm = Math.floor(s / 60);
	const ss = s % 60;
	return `${mm}:${ss.toString().padStart(2, '0')}`;
}
