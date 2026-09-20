# Parallel

**Send four people to a conference. Make sure they don't all learn the same thing.**

Parallel turns a public conference agenda into one coordinated team plan, then repairs it when
real life gets in the way. Teammates never open the app — the plan arrives by email and changes
come back as ordinary replies.

- **Live:** https://joyous-akita-768.convex.site
- **Repo:** https://github.com/Enoch208/parallel
- **Demo video:** not yet recorded
- **Posts:** not yet published

## Judge path, 60 seconds

1. Open **[/judges](https://joyous-akita-768.convex.site/judges)** and press **Run the demo**. It
   runs the real engine on a workspace of your own and shows five steps with the numbers computed
   as they happen: everyone planning alone, the optimizer splitting the team, a teammate replying
   that they cannot make a session, the repair moving only that person, and the best-placed
   teammate being asked to cover.
2. Press **Open this workspace on the board** to land on the live board for that same workspace.
3. Open **How Parallel worked** at the bottom of the board to see which service did what, and how
   long each step took.
4. Open a second tab on the same board. Press **Release** on a card in one tab and watch the other
   update. A write against a stale plan is refused with a message that says what to do.

## What each sponsor does

| Sponsor       | What it does here                                                                                                                                                                        | Where                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Convex**    | Database, reactive queries, the optimizer inside the mutation that writes the plan, the revision guard, the webhook endpoint, crons, four mounted components, and the static site itself | `convex/plan.ts`, `convex/assignments.ts`, `convex/http.ts` |
| **Firecrawl** | Scrapes the public agenda page through the official Firecrawl Convex component; every session keeps its source URL, fetch time and content hash                                          | `convex/model/firecrawlComponent.ts`                        |
| **OpenAI**    | Normalizes scraped markdown into sessions, scores each session against the team's goals, parses email replies, and writes the brief                                                      | `convex/model/openaiClient.ts`                              |
| **AgentMail** | One shared inbox: plan emails out, replies in through a signature-verified webhook, cover requests and the brief                                                                         | `convex/model/agentmailClient.ts`, `convex/http.ts`         |

## Convex components

Four components are mounted in `convex/convex.config.ts`:

| Component                     | What it carries                                                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@convex-dev/static-hosting`  | Serves the Vite app from `convex.site`, so the whole product is one deployment                                                                                                    |
| `@convex-dev/workflow`        | The agenda import runs as a durable workflow: scrape, record provenance, extract, insert, wait for scoring. Each step is named and retried, and the UI shows which one is running |
| `@convex-dev/workpool`        | Scoring runs in its own pool, so a long scoring run never starves the rest of the backend                                                                                         |
| `@firecrawl/firecrawl-convex` | Scraping, with the API key declared as component env rather than read from the outer deployment                                                                                   |

### `@agentmail/convex` was evaluated and rejected

We tried to route outbound mail through the AgentMail Convex component and reverted it. The
published package's `defineComponent("agentmail")` declares no `env` block, so the component
sandbox has its own empty environment: `process.env.AGENTMAIL_API_KEY` is undefined inside it no
matter what is set on the deployment, and Convex's server refuses to bind an environment variable
a component never declared. Every send through it failed with `Uncaught Error: AGENTMAIL_API_KEY
is not set` at a failure rate of 1.

**Parallel therefore does not use the AgentMail Convex component.** AgentMail is called directly
over its REST API from `convex/model/agentmailClient.ts`, and inbound mail arrives at our own
Convex HTTP endpoint with its Svix signature verified in `convex/model/svix.ts`. The revert was
clean and the static site stayed up throughout.

## What is real and what is demo data

The full chain has been exercised end to end on the development deployment
(`colorful-duck-212`), where it currently holds:

- **191 sessions**, including 9 imported from a real public agenda (ViVE, a health-tech
  conference), each with its source link, scraped and normalized end to end.
- **764 relevance scores** produced by real model calls; every row records the model that made it.
- **7 inbound email events**, including a reply sent from Gmail that travelled the whole chain:
  signature verified, routed by subject token, parsed, and applied to the board.
- **8 outbound emails** actually delivered through AgentMail.
- **4 takeaways** and a generated brief in which every claim cites a note that was handed to the
  model.

The production deployment behind the live link currently holds **seeded demo data only**: two
demo conferences on a reserved example domain, 28 sessions and 112 scores, all flagged
`isDemoData`. Pressing **Run the demo** on `/judges` builds a fresh workspace and runs the real
optimizer, repair and cover ranking against it, so everything a judge sees computed is genuinely
computed — but the scraped agenda and the email round-trip above were demonstrated on the
development deployment, not this one.

Demo data is labelled as demo data in the interface. The seeded demo conference is a fictional
event on a reserved example domain, so no invented agenda is ever attributed to a real organizer.

Counters read `—` until a real value exists. No number in this product is typed in except the trip
cost estimate, which the team lead enters and which is captioned as their own figure.

## Convex map

| Feature                      | File                                          | What a user sees                                                                              |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Optimizer inside a mutation  | `convex/plan.ts`                              | Press Optimize; the plan is written in one transaction with the constraints it was built from |
| Durable import workflow      | `convex/importWorkflow.ts`                    | The import shows the step it is on, and survives a failure mid-run                            |
| Revision guard               | `convex/model/assignmentGuards.ts`            | A stale write is refused: "The plan changed while you were looking at it"                     |
| One acceptance path          | `convex/model/coverAcceptance.ts`             | Accepting a cover from the board and by email run the same checks                             |
| Coverage as a reactive query | `convex/plan.ts`                              | Counters move the moment anyone claims or releases                                            |
| Verified webhook             | `convex/http.ts`, `convex/model/svix.ts`      | Replying to a plan email turns the board amber                                                |
| Idempotent sends             | `convex/emailSendWrites.ts`                   | Re-running a send delivers nothing twice                                                      |
| Incremental rescoring        | `convex/scoringReuse.ts`, `convex/scoring.ts` | Re-importing an unchanged agenda spends nothing on the model                                  |
| Scheduler and crons          | `convex/crons.ts`                             | Takeaway prompts become due when a session ends                                               |
| Guest workspaces             | `convex/guest.ts`                             | Your clicks never change another visitor's board                                              |

## What the solver actually proves

Two modes, and the product says which one it used. On a small enough instance a branch-and-bound
search explores the whole space and reports **proven optimal**. On a larger one it reports the best
plan it found together with a mathematically derived upper bound, so the most it could be wrong by
is stated rather than hidden.

Repair is a separate proof. When constraints change, Parallel computes the **lexicographic
minimum** number of teammates who have to move, and will not move anyone else — a repair that
would reassign an uninvolved teammate's day is refused, because that person never consented to it.

Coverage is reported against the largest set of sessions the team could physically attend, solved
exactly as a k-track interval scheduling problem rather than estimated.

The engine is verified by randomized property testing rather than a handful of fixtures: generated
instances checked for hard-constraint violations, exact-versus-brute-force comparisons with zero
disagreements, and determinism checked by running the same instance twice and by reversing input
order. **36 test files, 313 tests.** The tests also found that beam search alone is genuinely
suboptimal on a measurable share of instances, which is why the exact mode exists.

## Known issues

- On a large agenda the solver runs out of search budget and reports "best found, not proven
  optimal" with the size of the gap, rather than claiming an optimum it has not proved. The demo
  agenda is just past that threshold.
- The optimizer will leave a teammate free rather than create duplicate attendance that adds no
  coverage. The lane says so, and anyone can take a session from it by hand.
- A send accepted by the email provider whose response never reaches us would be retried, so
  at-least-once delivery is possible in that narrow window.
- When a re-published agenda cancels a session, the row stays in the database so the assignments
  pointing at it are not orphaned. It is reported as cancelled and counted as disrupting, but it
  is still drawn on the board until someone removes it.
- Two sittings of a generic title with no surviving anchor — two "Lunch" entries where one
  survives in a different room at a different time — are reported as ambiguous rather than paired.
  That is deliberate: the alternative is guessing which one moved.
