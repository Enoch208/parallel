# Parallel

**Send four people to a conference. Make sure they don't all learn the same thing.**

A company spends thousands sending a team to a multi-track event. Left to themselves, everyone
picks the same famous keynotes, whole tracks go unwatched, and the notes come home in four
notebooks. Teams already try to divide and conquer — in spreadsheets and group chats — and it falls
apart the moment the day does.

Parallel turns a public conference agenda into one coordinated team plan, keeps it current by
email, and brings the learning home as a single brief organized by what the team came to learn.

**AI understands the conference. Deterministic code decides who goes where.**

## How it works

1. **Import.** Paste a public agenda URL. The import runs as a durable Convex workflow — scrape,
   record provenance, extract, insert, score — so a failure halfway through resumes rather than
   starting over, and the screen shows which step is running. Every session keeps the source URL
   and fetch time it came from, so any field can be traced back to the page it was read from.
2. **Intent.** Add three to six weighted goals. Each session is scored against each goal with a
   one-line reason.
3. **Optimize.** One click splits the team. Nobody is in two places at once, nobody is assigned
   over a block they recorded, and a pinned session is never silently dropped. On a small enough
   agenda the search proves it found the best possible plan; on a larger one it states how far off
   it could be.
4. **Repair.** A teammate replies to their plan email in their own words. The plan goes stale on
   every screen, the gap becomes visible, and the best-placed teammate is asked to cover — asked,
   not moved. Repair computes the smallest number of people who have to change their day and
   refuses to touch anyone else.
5. **Brief.** Takeaways arrive as email replies and end as one brief grouped by goal, where every
   claim cites the note it came from.

## What the numbers mean

**Team Goal Coverage** is a score from 0 to 100: how strongly the team's assigned sessions cover
its weighted goals, with diminishing returns for redundant sessions. A fourth similar session on
the same goal counts for less than the first.

Beside it sit two literal counts that need no explanation: **unique sessions assigned**, shown
against the most the team could physically attend, and **duplicate attendances**, reported rather
than forbidden — sometimes two people in one room is the right call.

"The most the team could physically attend" is computed, not estimated: it is the largest set of
sessions that can be split across the team with nobody double-booked, which is k-track interval
scheduling, solved exactly in `convex/engine/attendable.ts`.

## Rules the product keeps

- AI never does schedule math. The optimizer is deterministic and unit tested.
- Every imported field keeps its source URL and fetch time.
- An email reply is applied only when the sentence it relied on appears verbatim in the message. A
  paraphrase is refused even at high confidence.
- A teammate's own "can't make it" applies at once. Nothing that changes someone else's day
  happens without their answer.
- Accepting a cover runs the same checks as claiming a session by hand: one shared set of
  invariants in `convex/model/assignmentGuards.ts`, re-read at the moment of the write, never
  trusted from when the request was sent.
- Demo data is labelled as demo data.

## Running it

Requires Node 24 and pnpm 10.

```bash
pnpm install
npx convex dev            # provisions a deployment and pushes the backend
pnpm dev                  # the app, against that deployment
```

The backend needs four environment variables on the Convex deployment:

```bash
npx convex env set OPENAI_API_KEY <key>
npx convex env set FIRECRAWL_API_KEY <key>
npx convex env set AGENTMAIL_API_KEY <key>
npx convex env set AGENTMAIL_INBOX <inbox@agentmail.to>
```

Inbound email also needs a webhook pointed at `https://<deployment>.convex.site/api/webhooks/agentmail`
for the `message.received` event, and its signing secret stored as `AGENTMAIL_WEBHOOK_SECRET`.

```bash
pnpm test                 # unit tests
pnpm typecheck
pnpm lint
pnpm deploy               # build, push the backend, upload the site
```

## Layout

| Path             | What lives there                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `convex/engine/` | The optimizer: coverage math, beam search, exact search, repair. Pure TypeScript, no network                   |
| `convex/model/`  | Provider clients, the shared write guards, and the pure helpers around them                                    |
| `convex/`        | Queries, mutations, actions, the import workflow, the webhook and crons                                        |
| `src/`           | The Vite app: board, agenda, goals, notes, brief                                                               |
| `tests/`         | The engine, email parsing, the brief, adversarial cases, and Convex mutations run against an in-memory backend |

## Components

The backend mounts four Convex components (`convex/convex.config.ts`):
`@convex-dev/static-hosting` serves the built app from `convex.site`, `@convex-dev/workflow` runs
the agenda import durably, `@convex-dev/workpool` isolates scoring, and
`@firecrawl/firecrawl-convex` does the scraping.

`@agentmail/convex` was evaluated and rejected. Its `defineComponent("agentmail")` declares no
`env` block, so `process.env.AGENTMAIL_API_KEY` is undefined inside the component's sandbox
whatever is set on the deployment, and Convex refuses to bind an environment variable a component
has not declared; every send failed with `AGENTMAIL_API_KEY is not set`. AgentMail is called
directly over its REST API from `convex/model/agentmailClient.ts` instead, and inbound mail lands
on our own HTTP endpoint with its Svix signature verified.

## Licences

Dependency licences are audited in [THIRD_PARTY.md](THIRD_PARTY.md).
