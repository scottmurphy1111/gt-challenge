import { describe, it, expect } from 'vitest';
import {
	assertTransition,
	canTransition,
	InvalidTransitionError,
	isTerminal,
	nextStatuses
} from './state-machine';
import { SESSION_STATUSES, type SessionStatus } from '$lib/shared/types';

describe('checkout state machine', () => {
	it('permits the happy path active -> completing -> completed', () => {
		expect(canTransition('active', 'completing')).toBe(true);
		expect(canTransition('completing', 'completed')).toBe(true);
	});

	it('permits retry after failure but not from terminal states', () => {
		expect(canTransition('failed', 'active')).toBe(true);
		expect(canTransition('completed', 'active')).toBe(false);
		expect(canTransition('expired', 'active')).toBe(false);
	});

	it('permits expiration only from active', () => {
		expect(canTransition('active', 'expired')).toBe(true);
		expect(canTransition('completing', 'expired')).toBe(false);
	});

	it('marks completed and expired as terminal', () => {
		expect(isTerminal('completed')).toBe(true);
		expect(isTerminal('expired')).toBe(true);
		expect(isTerminal('active')).toBe(false);
		expect(isTerminal('completing')).toBe(false);
		expect(isTerminal('failed')).toBe(false);
	});

	it('rejects any transition out of a terminal state', () => {
		for (const to of SESSION_STATUSES) {
			expect(canTransition('completed', to)).toBe(false);
			expect(canTransition('expired', to)).toBe(false);
		}
	});

	it('assertTransition throws with a typed error on bad transitions', () => {
		expect(() => assertTransition('active', 'completed')).toThrow(InvalidTransitionError);
		try {
			assertTransition('active', 'completed');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidTransitionError);
			const err = e as InvalidTransitionError;
			expect(err.from).toBe('active');
			expect(err.to).toBe('completed');
		}
	});

	it('nextStatuses lists exactly the reachable states', () => {
		expect(new Set(nextStatuses('active'))).toEqual(
			new Set<SessionStatus>(['completing', 'expired'])
		);
		expect(new Set(nextStatuses('completing'))).toEqual(
			new Set<SessionStatus>(['completed', 'failed'])
		);
		expect(nextStatuses('completed')).toEqual([]);
	});

	it('is exhaustive: every declared status has a transition entry', () => {
		for (const s of SESSION_STATUSES) {
			expect(() => nextStatuses(s)).not.toThrow();
		}
	});
});
