# checkout continuity

Small SvelteKit prototype for the Gametime take-home. A fan can start a
checkout on one surface (web or a "mobile" deep link) and pick it up on the
other without duplicate orders, stale holds, or hidden price changes.

## running it

```sh
bun install
bun run dev
```

No env vars, no database. State lives in Maps in the Node process, seeded
with three demo listings at boot. Restarting the server wipes everything.

Visit `http://localhost:5173`, pick a listing, and hit "Start checkout". On
the checkout page there's a dev-controls panel with buttons to expire the
hold, bump the price, or fail the next payment — that's how you demo the
state transitions. "Open mobile surface" opens `/m/<id>` in a new tab; do
things on one, watch them show up on the other.

Tests: `bun run test`. Each scenario test spins up a fresh in-memory store —
no isolation cleanup needed.

## API

```
POST /api/checkout                       { listingId } -> session
GET  /api/checkout/:id                                 -> session
POST /api/checkout/:id/complete          { acceptedPriceCents } -> { orderId }

POST /api/dev/expire/:id
POST /api/dev/bump-price/:listingId      { priceCents }
POST /api/dev/fail-next-payment/:id      { value }
```

## state model

Sessions have one status column, transitioned through a fixed matrix in
`src/lib/server/state-machine.ts`.

- `active` → `completing` → `completed`
- `active` → `expired` (hold lapsed, lazy — flipped on next resume)
- `completing` → `failed` (payment declined)
- `failed` → `active` (retry, only if hold still valid)

`completed` and `expired` are terminal.

Price-change isn't a state — it's derived from
`listing.priceCents !== session.priceSnapshotCents`. The resume payload
carries `priceChanged: true` and the shell shows a banner. Completion
takes `acceptedPriceCents`; the server rejects anything that doesn't
match the current price. That means the ack is stateless: client says
"I accept $X", server checks $X == current. No extra column, no
invalidation logic.

## resuming across surfaces

Same URL scheme (`sessionId` in the path), same server loader, same
component. `/checkout/[id]` and `/m/[id]` differ only in chrome. Both
SSR the shell (event, price, hold timer, CTA) so first byte is
useful — the JS bundle is only needed for the live countdown and
the poll-refresh.

Cross-surface freshness is a `pollOnFocus` helper (`src/lib/client/`) —
refetches on visibility change, on window focus, and every 15s while
visible. Not SSE. Simpler; also mobile background lifecycle is friendlier
to discrete refetches than long-lived streams.

## duplicate completion / idempotency

The complete flow's critical section is a synchronous check-and-set on the
session row:

```ts
if (row.status !== 'active' || row.completionKey !== null) {
	// lost — either already completed, or another caller is finishing
}
row.status = 'completing';
row.completionKey = randomUUID();
```

JS is single-threaded, so as long as there's no `await` between the check
and the set, the whole block is atomic. Two concurrent completes can't
both win. See the "race" scenario test.

`completions` is an array; uniqueness is enforced by a `.find()` guard in
the service before pushing. This is what a `UNIQUE(session_id)` index
would do in a real DB, minus the "the database will yell at me" backstop.

## payment failure

Payment failure resets `completionKey` and clears the dev `forcePaymentFail`
flag, then moves the session to `failed`. A retry from the client re-enters
via `POST /complete`; the service sees `status=failed` and, if the hold's
still valid, transitions back to `active` before running the normal complete
flow. No new endpoint.

## things I didn't get to / would change

- **This should be a real database.** Swapping the store for Postgres
  (Drizzle + Neon was the earlier draft) is a one-file change to
  `services/checkout.ts`. Idempotency stays honest either way —
  the sync critical section becomes a conditional `UPDATE ... WHERE
status = 'active' AND completion_key IS NULL`, and the Map's implicit
  uniqueness becomes a `UNIQUE(session_id)` index on `completions`.
- **Inventory service is a stub.** Interface is real (`tryHold`, `release`),
  impl is not. A real one would decrement a listing-level counter.
- **No auth.** Session ids are unguessable UUIDs so it's not trivially
  hijackable, but a real version would tie sessions to a fan id.
- **Poll interval is hard-coded at 15s.** Should be a config, and honestly
  it should probably back off when the tab's been idle a while.
- **No progressive-enhancement form action** on the complete button —
  it uses `fetch`. The shell renders without JS but the submit path
  assumes it.
- **State resets on server restart.** Fine for a prototype; obviously
  not for production.
- **Would love E2E tests** driving both routes in parallel via Playwright
  to actually exercise the poll pipeline. The scenario tests hit the
  service layer, which is where the interesting logic is, but a real
  cross-surface test would be more convincing.

## how you'd measure whether this actually helps conversion

Every state change bumps `version` and `updatedAt`. Add a small
`session_events` log (append-only), then the funnel query is:

- sessions that had a resume from a different surface than they were created on
- of those, sessions that reached `completed`

Delta vs the baseline is the continuity win. Interesting cuts:
`priceChanged` ever = true, retries after a failure, sessions that hit
`expired`.
