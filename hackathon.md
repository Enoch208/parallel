# Parallel

**Send four people to a conference. Make sure they don't all learn the same thing.**

Parallel turns a public conference agenda into one coordinated team plan, then repairs it when
real life gets in the way. Teammates never open the app — the plan arrives by email and changes
come back as ordinary replies.

- **Live:** https://joyous-akita-768.convex.site
- **Repo:** https://github.com/Enoch208/parallel
- **Demo video:** not yet recorded
- **Posts:** not yet published

## The verified production run

**[Open the real plan](https://joyous-akita-768.convex.site/board?c=js711hd3g819z5kw11bv8ntqm58erbt5)** — one
permanent workspace on production holding a complete run. Nothing in it is seeded.

- The agenda is the public [ViVE 2026 agenda](https://www.viveevent.com/agenda/), scraped by
  Firecrawl and stored with its fetch time and content hash. Unofficial, and not affiliated with
  the event.
- OpenAI normalized nine sessions from that page and scored each one against the team's four goals.
- The optimizer split the team: Team Goal Coverage 90.5 across nine unique sessions.
- A teammate replied by email, in his own words, that he could not make an 11:30 session. The
  signature-verified webhook accepted it, OpenAI parsed it at 0.98 confidence, and the sentence it
  relied on is stored verbatim beside the constraint.
- The plan went stale against the revision guard. The repair moved **one** person: coverage 90.5 to
  88.8, with one session left open rather than silently dropped.
- Parallel emailed the best-placed teammate with the arithmetic for why him. He replied YES.
  Coverage returned to 90.5 across nine unique sessions.

The board reads **91.1** today rather than 90.5. One of the thirty-six session-and-goal pairs had no
model output when the run took place; scoring it afterwards completed the matrix and moved the
figure. The steps above are the numbers the run itself produced, and the Evidence screen shows every
score with the model that made it.

Open **How Parallel worked** on that board to see each step with the service that performed it, and
**Evidence** to follow any number back to its source.

Two of the five teammates are real people with real inboxes. The other three are placeholders whose
addresses do not receive mail, and the board reports the one duplicate attendance rather than
hiding it.

## Judge path, 60 seconds

1. Open **[/judges](https://joyous-akita-768.convex.site/judges)** and press **Run the demo**. It
   runs the real engine on a workspace of your own and shows five steps with the numbers computed
   as they happen: everyone planning alone, the optimizer splitting the team, a teammate replying
   that they cannot make a session, the repair moving only that person, and the best-placed
   cover candidate being proposed. The reply is simulated and this path sends no email.
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

Production was checked directly on **21 September 2026**. Alongside the seeded demo workspaces it
holds a real ViVE import with **9 sessions**, a source URL, fetch time and SHA-256 content hash,
and a complete **36 of 36 relevance scores** recorded with `gpt-5.4-mini`. Plan sends carry AgentMail
provider message IDs, and the reply-to-repair round trip has completed on that workspace: a real
reply reached the signed webhook, was parsed as `cant_attend` at 0.98 confidence, became an
availability block carrying the teammate's verbatim sentence, marked the plan stale, drove a
one-person repair, and a second teammate accepted the cover by replying YES. That workspace is
linked at the top of this file and every step is listed in its activity panel.

Pressing **Run the demo** on `/judges` builds a fresh seeded workspace and runs the real optimizer,
repair and cover ranking. Its constraint change is simulated; it does not send or receive email.

Demo data is labelled as demo data in the interface. The seeded demo conference is a fictional
event on a reserved example domain, so no invented agenda is ever attributed to a real organizer.

Counters read `—` until a real value exists. No number in this product is typed in except the trip
cost estimate, which the team lead enters and which is captioned as their own figure.

## Convex map

| Feature                      | File                                               | What a user sees                                                                                         |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Optimizer inside a mutation  | `convex/plan.ts`                                   | Press Optimize; the plan is written in one transaction with the constraints it was built from            |
| Durable import workflow      | `convex/importWorkflow.ts`                         | The import shows the step it is on, and survives a failure mid-run                                       |
| Revision guard               | `convex/model/assignmentGuards.ts`                 | A stale write is refused: "The plan changed while you were looking at it"                                |
| One acceptance path          | `convex/model/coverAcceptance.ts`                  | Accepting a cover from the board and by email run the same checks                                        |
| Coverage as a reactive query | `convex/plan.ts`                                   | Counters move the moment anyone claims or releases                                                       |
| Verified webhook             | `convex/http.ts`, `convex/model/svix.ts`           | Replying to a plan email turns the board amber                                                           |
| Idempotent sends             | `convex/emailSendWrites.ts`                        | Re-running a send delivers nothing twice                                                                 |
| Daily send budget            | `convex/emailSend.ts`, `convex/emailSendWrites.ts` | Every send is counted against a rolling 24 hour cap before it leaves, so a loop cannot drain the mailbox |
| Takeaways by reply           | `convex/emailReplies.ts`                           | Answering a plan email with what you learned files a note against that session                           |
| Incremental rescoring        | `convex/scoringReuse.ts`, `convex/scoring.ts`      | Re-importing an unchanged agenda spends nothing on the model                                             |
| Scheduler and crons          | `convex/crons.ts`                                  | Takeaway prompts become due when a session ends                                                          |
| Guest workspaces             | `convex/guest.ts`                                  | Your clicks never change another visitor's board                                                         |

## What the solver actually proves

Two modes, and the product says which one it used. On a small enough instance a branch-and-bound
search explores the whole space and reports **proven optimal**. On a larger one it reports the best
plan it found together with a mathematically derived upper bound, so the most it could be wrong by
is stated rather than hidden.

Repair has two distinct results. `repairWithMinimumDisruption` identifies the minimum set of
teammates whose current schedules cannot remain feasible; its further assignment and coverage
tie-breaks may exhaust their search budget. `plan.repair` stores that analysis as metadata, but
saves assignments from `repairPlan` after filtering out new member/session pairs. The saved
plan is therefore a conservative consent-filtered proposal, not the lexicographically optimal
plan from the separate analysis. Cover acceptance adds an assignment only after consent and
fresh feasibility checks.

Coverage is reported against the largest set of sessions the team could physically attend, solved
exactly as a k-track interval scheduling problem rather than estimated.

The engine is verified by randomized property testing rather than a handful of fixtures: generated
instances checked for hard-constraint violations, exact-versus-brute-force comparisons with zero
disagreements, and determinism checked by running the same instance twice and by reversing input
order. **38 test files, 325 tests, passing locally and in GitHub Actions on 21 September 2026.** The suite also checks that repair activity reports the coverage of saved assignments,
excluding proposed cover that has not been accepted. The tests found that beam search alone is genuinely
suboptimal on a measurable share of instances, which is why the exact mode exists.

## Known issues

- The import workflow reports success even when the model returns fewer scores than were requested.
  The production run finished one pair short and was completed by rescoring; the workflow should
  treat a short matrix as partial rather than complete.
- A reply whose wording matches no session stays pending in the backend, and the app exposes no
  control to resolve one by hand. Two replies sent before session matching was widened are still in
  that state and are listed on the Evidence screen.
- The brief closes the loop in the product and is covered by tests, but the permanent production
  run above stops at the accepted cover; it does not yet carry takeaways and a sent brief.
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
