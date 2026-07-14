// Session state machine. Small on purpose.
//
// Terminal states: completed, expired.
// failed -> active is allowed for retry, but the service checks the hold
// separately before letting it happen.

import { TERMINAL_STATUSES, type SessionStatus } from '$lib/shared/types';

const TRANSITIONS: Record<SessionStatus, ReadonlySet<SessionStatus>> = {
	active: new Set(['completing', 'expired']),
	completing: new Set(['completed', 'failed']),
	completed: new Set(),
	failed: new Set(['active']),
	expired: new Set()
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
	return TRANSITIONS[from].has(to);
}

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
	if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(status: SessionStatus): boolean {
	return TERMINAL_STATUSES.has(status);
}

export function nextStatuses(from: SessionStatus): SessionStatus[] {
	return [...TRANSITIONS[from]];
}

export class InvalidTransitionError extends Error {
	constructor(
		public readonly from: SessionStatus,
		public readonly to: SessionStatus
	) {
		super(`invalid transition: ${from} -> ${to}`);
		this.name = 'InvalidTransitionError';
	}
}
