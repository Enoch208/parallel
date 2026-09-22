# Parallel

**Send four people to a conference. Make sure they don't all learn the same thing.**

Parallel turns a public conference agenda into one coordinated team plan, then repairs it when
real life gets in the way. Teammates never open the app — the plan arrives by email and changes
come back as ordinary replies.

- **Live:** https://joyous-akita-768.convex.site
- **Repo:** https://github.com/Enoch208/parallel
- **Demo video (2:40):** https://youtu.be/dxzxkJJZu2E
- **Launch post:** [the thread on X](https://x.com/dreyethh/status/2102150744862310756)
- **Auth:** none. Workspaces are reached by opaque links, and a link is the access key (see Known issues); teammates interact through email and never need an account.

## At a glance

| Criterion    | Where to look                                                                                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everyday use | Send four people to a conference and make sure they don't all learn the same thing. Teammates never open an app: they reply to email.                                                                                                                                              |
| Convex       | 19 tables in `convex/schema.ts`; the optimizer inside the plan-writing mutation (`convex/plan.ts`); a durable import workflow (`convex/importWorkflow.ts`); a scoring workpool; three crons (`convex/crons.ts`); the scheduler; six mounted components (`convex/convex.config.ts`) |
| OpenAI       | Structured outputs in `convex/model/openaiClient.ts`, used by `convex/importWorkflow.ts`, `convex/scoring.ts`, `convex/emailReplies.ts` and `convex/brief.ts`                                                                                                                      |
| Firecrawl    | The official Convex component in `convex/model/firecrawlComponent.ts`; content hashes in `convex/model/firecrawlClient.ts`; change detection in `convex/agendaWatch.ts`                                                                                                            |
| AgentMail    | A Svix-verified webhook in `convex/http.ts` and `convex/model/svix.ts`; sends in `convex/emailSend.ts` through `convex/model/agentmailClient.ts`                                                                                                                                   |
| Proof        | [The verified production run](#the-verified-production-run), the 2:40 video, and 57 test files with 409 tests                                                                                                                                                                      |

## The verified production run

**[Open the real plan](https://joyous-akita-768.convex.site/board?c=js711hd3g819z5kw11bv8ntqm58erbt5)** — a
permanent production workspace created through the real application flow, using the public ViVE
2026 agenda. The conference scenario itself was played out for verification. The workspace is
read-only: every change from the app is refused, so the record stays exactly as it happened.

- The agenda is the public [ViVE 2026 agenda](https://www.viveevent.com/agenda/), scraped by
  Firecrawl and stored with its fetch time and content hash. Unofficial, and not affiliated with
  the event.
- OpenAI normalized nine sessions from that page and scored each one against the team's four goals.
- The optimizer split the team: Team Goal Coverage 90.5 across nine unique sessions.
- A teammate replied by email that he could not make an 11:30 session. The signature-verified
  webhook accepted it, OpenAI parsed it at 0.98 confidence, and the sentence it relied on is stored
  verbatim beside the constraint.
- The plan went stale against the revision guard. The repair moved **one** person: coverage 90.5 to
  88.8, with one session left open rather than silently dropped.
- Parallel emailed the best-placed teammate with the arithmetic for why him. He replied YES.
  Coverage returned to 90.5 across nine unique sessions.
- He then replied with a takeaway from the session he covered. It was filed as a note against that
  session, OpenAI wrote the brief from it with a source on every claim, and AgentMail delivered the
  brief to the team lead.

The email is real: two real inboxes, real replies, a verified webhook and real deliveries. The
conference is played out. Nobody on the team attended ViVE 2026, so the reasons in the replies and
the takeaway were written for the run rather than lived. His first attempt at the takeaway named the
session and said nothing else; Parallel now keeps a reply like that pending instead of filing it,
and that empty note is marked rejected so the brief never used it.

The board reads **91.1** today rather than 90.5. One of the thirty-six session-and-goal pairs had no
model output when the run took place; scoring it afterwards completed the matrix and moved the
figure. The steps above are the numbers the run itself produced, and the Evidence screen shows every
score with the model that made it.

Open **How Parallel worked** on that board to see each step with the service that performed it, and
**Evidence** to follow any number back to its source.

Two of the five teammates are real people with real inboxes. The other three are placeholders whose
addresses do not receive mail, and the board reports the one duplicate attendance rather than
hiding it.

## A second run: four takeaways, one brief

**[Open the board](https://joyous-akita-768.convex.site/board?c=js75bc7kx7r9c851cfzmhygvtx8evqsn)** · **[read its brief](https://joyous-akita-768.convex.site/brief?c=js75bc7kx7r9c851cfzmhygvtx8evqsn)** — a second permanent production
workspace on the same public ViVE agenda, built through the same flow and also read-only.

- Team Goal Coverage 59 for the same teammates each attending only their own picks, a computed
  baseline, against 90.4 for the coordinated plan, across 9 of 9 sessions.
- A teammate replied that he could not make a session; the repair moved one person, and another
  teammate took the session by replying YES.
- Four teammates each replied by email with a takeaway. OpenAI wrote the brief from those four: 8
  claims across the team's 4 goals, every one citing the takeaway it came from, none dropped.
  AgentMail delivered it to the team lead.

In this run all four teammates are plus-address aliases of the team lead's own inbox, and the lead
wrote every reply, including the takeaways. The email is real; the conference was played out.

## Judge path, 60 seconds

1. Open **[/judges](https://joyous-akita-768.convex.site/judges)**. The top row reads the verified
   production run live: Team Goal Coverage for the same teammates each planning only for
   themselves, a computed baseline rather than observed behaviour, against the coordinated plan.
   Press **Run the demo**. It
   runs the real engine on a workspace of your own and shows five steps with the numbers computed
   as they happen: everyone planning alone, the optimizer splitting the team, a teammate replying
   that they cannot make a session, the repair moving only that person, and the best-placed
   cover candidate being proposed. The reply is simulated and this path sends no email.
2. Under **Try it with your own email**, press **Open in my email app** and send the prefilled
   message from any inbox, or copy the address, subject and message. The subject carries a one-use
   code for that demo workspace. When the email is read, the status line says the plan changed;
   open the board and press **Repair the plan**.
3. Press **Open this workspace on the board** to land on the live board for that same workspace.
   **Open verified production run**, beside **Run the demo**, opens the real run instead.
4. Open **How Parallel worked** at the bottom of the board to see which service did what, and how
   long each step took.
5. Open a second tab on the same board. Press **Release** on a card in one tab and watch the other
   update. A write against a stale plan is refused with a message that says what to do.
6. Back on **/judges**, press **Run the attacks** under _Try to break it_. Four guards are attacked
   through the production code on a throwaway workspace that is deleted afterwards: the same webhook
   delivered twice, a write from a browser whose plan has moved on, a model quote that paraphrases
   the email, and a send retried with the same key. Each reports what it refused and why.

### The judge email path, verified on production

The code in the subject is 128 random bits, stored only as a SHA-256 hash, scoped to one demo
teammate for two hours and allowed to apply only `cant_attend`. Normal teammate routing runs first
and is unchanged; the code is tried only when nothing else matched, and never on a workspace that is
real or frozen. Three emails per code in ten minutes; the first applied change revokes it.

On production on 22 September 2026, a real email sent from Gmail with the prefilled subject reached
the AgentMail webhook, was routed by its code to that demo workspace alone, and was read as
`cant_attend` at 0.99 confidence with its exact sentence. It applied once: one availability block,
the workspace revision moved from 1 to 2, and the board went stale. The code was then revoked, the
stored subject reads `[JD-redacted]`, and Evidence shows the sender as `e•••@gmail.com`. Pressing
**Repair the plan** returned a current plan at Team Goal Coverage 99.8 with 12 unique sessions and no
duplicates. Replaying the same reply through the step a webhook redelivery runs, a second parse and a direct
write changed nothing.

## What each sponsor does

| Sponsor       | What it does here                                                                                                                                                                       | Where                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Convex**    | Database, reactive queries, the optimizer inside the mutation that writes the plan, the revision guard, the webhook endpoint, crons, six mounted components, and the static site itself | `convex/plan.ts`, `convex/assignments.ts`, `convex/http.ts` |
| **Firecrawl** | Scrapes the public agenda page through the official Firecrawl Convex component; every session keeps its source URL, fetch time and content hash                                         | `convex/model/firecrawlComponent.ts`                        |
| **OpenAI**    | Normalizes scraped markdown into sessions, scores each session against the team's goals, parses email replies, and writes the brief                                                     | `convex/model/openaiClient.ts`                              |
| **AgentMail** | One shared inbox: plan emails out, replies in through a signature-verified webhook, cover requests and the brief                                                                        | `convex/model/agentmailClient.ts`, `convex/http.ts`         |

## Convex components

Six components are mounted in `convex/convex.config.ts`:

| Component                     | What it carries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@convex-dev/static-hosting`  | Serves the Vite app from `convex.site`, so the whole product is one deployment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `@convex-dev/workflow`        | The agenda import runs as a durable workflow: scrape, record provenance, extract, insert, wait for scoring. Each step is named and retried, and the UI shows which one is running                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@convex-dev/workpool`        | Scoring runs in its own pool, so a long scoring run never starves the rest of the backend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `@firecrawl/firecrawl-convex` | Scraping, with the API key declared as component env rather than read from the outer deployment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `@convex-dev/rate-limiter`    | Rate-limits four public entry points before any work: brief generation per conference (three at once, six an hour); demo runs (five at once, ten an hour) and agenda imports through the import workflow (two at once, three an hour) per browser visitor id; and judge emails per demo code (three in ten minutes). The visitor id is accidental-abuse and quota protection, not authentication or a hard security boundary, and there is no global cap. Other public actions that call a provider are not rate-limited: the older direct `importAgenda` action, `scoring.scoreConference`, and the agenda change checks. Outbound email has its own 80-a-day send budget. `convex/model/rateLimits.ts`, `convex/model/visitorKey.ts`, `convex/brief.ts`, `convex/judges.ts`, `convex/importWorkflow.ts`, `convex/emailIngest.ts` |
| `@convex-dev/action-retrier`  | Inbound email parsing. Each reply is saved and its parse queued in the same mutation; network errors, 429 and 5xx from OpenAI are retried up to three times with exponential backoff, and the retrier's completion callback marks the reply handled, needing review or failed. A reply whose parsing failed stays on the Evidence screen with a Retry parsing button. `convex/replyParsing.ts`, `convex/model/replyRetrier.ts`, `convex/emailIngest.ts`, `convex/emailReplies.ts`                                                                                                                                                                                                                                                                                                                                                  |

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
one-person repair, and a second teammate accepted the cover by replying YES. That teammate's
takeaway became the note the brief was written from, and the brief was delivered through AgentMail
with a provider message ID. That workspace is linked at the top of this file and every step is
listed in its activity panel.

Pressing **Run the demo** on `/judges` builds a fresh seeded workspace and runs the real optimizer,
repair and cover ranking. Its constraint change is simulated; it does not send or receive email.

Demo data is labelled as demo data in the interface. The seeded demo conference is a fictional
event on a reserved example domain, so no invented agenda is ever attributed to a real organizer.

Counters read `—` until a real value exists. No number in this product is typed in except the trip
cost estimate, which the team lead enters and which is captioned as their own figure.

## Convex map

| Feature                      | File                                               | What a user sees                                                                                                |
| ---------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Optimizer inside a mutation  | `convex/plan.ts`                                   | Press Optimize; the plan is written in one transaction with the constraints it was built from                   |
| Durable import workflow      | `convex/importWorkflow.ts`                         | The import shows the step it is on, and survives a failure mid-run                                              |
| Revision guard               | `convex/model/assignmentGuards.ts`                 | A stale write is refused: "The plan changed while you were looking at it"                                       |
| One acceptance path          | `convex/model/coverAcceptance.ts`                  | Accepting a cover from the board and by email run the same checks                                               |
| Coverage as a reactive query | `convex/plan.ts`                                   | Counters move the moment anyone claims or releases                                                              |
| Verified webhook             | `convex/http.ts`, `convex/model/svix.ts`           | Replying to a plan email turns the board amber                                                                  |
| Idempotent sends             | `convex/emailSendWrites.ts`                        | Re-running a send delivers nothing twice                                                                        |
| Daily send budget            | `convex/emailSend.ts`, `convex/emailSendWrites.ts` | Every send is counted against a rolling 24 hour cap before it leaves, so a loop cannot drain the mailbox        |
| Takeaways by reply           | `convex/emailReplies.ts`                           | Answering a plan email with what you learned files a note against that session                                  |
| Incremental rescoring        | `convex/scoringReuse.ts`, `convex/scoring.ts`      | Re-importing an unchanged agenda spends nothing on the model                                                    |
| Scheduler and crons          | `convex/crons.ts`                                  | Takeaway prompts become due when a session ends                                                                 |
| Demo workspaces              | `convex/guest.ts`                                  | Reached by their link, which is the access key, and removed by a six-hourly cleanup once more than 24 hours old |

## What the solver actually proves

Repair preserves existing assignments that remain feasible; a separate minimum-disruption analysis computes the minimum set of teammates whose schedules cannot all remain unchanged, and Parallel never adds a new cover assignment until that teammate says yes.

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
order. **57 test files, 409 tests, passing locally and in GitHub Actions on 22 September 2026.** The suite also checks that repair activity reports the coverage of saved assignments,
excluding proposed cover that has not been accepted. The tests found that beam search alone is genuinely
suboptimal on a measurable share of instances, which is why the exact mode exists.

## Known issues

- **Access boundary.** This hackathon build uses opaque workspace links rather than organization
  authentication: no Convex function checks who is calling, so anyone with a workspace's link can
  read that workspace and, unless it is frozen, change it. On a workspace that is not frozen, that
  includes its teammates' email addresses, which its public queries return. On a frozen workspace,
  such as the verified ViVE run, every address leaves Convex masked, and a judge's own address is
  masked on Evidence in every workspace. Judge and demo workspaces are removed by a cleanup that
  runs every six hours once they are more than 24 hours old. The verified ViVE workspace is
  intentionally public and read-only. A production deployment handling private company conference
  data would put authenticated organization membership in front of workspace reads and writes.
- **Not every provider call is rate-limited.** The older direct `importAgenda` action, scoring and
  the agenda change checks are public and bounded only by provider quotas; the limits cover brief
  generation, demo runs, workflow imports and judge emails.
- The first verified run's brief rests on one takeaway, because only one teammate with a working
  inbox reported back; for the other goals the model fell back to claims that only cite the agenda.
  The second run's brief rests on four takeaways, but one person wrote all four while playing four
  teammates, so neither brief reflects a real team's range of input.
- On a large agenda the solver runs out of search budget and reports "best found, not proven
  optimal" with the size of the gap, rather than claiming an optimum it has not proved. The demo
  agenda is just past that threshold.
- The optimizer will leave a teammate free rather than create duplicate attendance that adds no
  coverage. The lane says so, and anyone can take a session from it by hand.
- A send accepted by the email provider whose response never reaches us would be retried, so
  at-least-once delivery is possible in that narrow window.
- Two sittings of a generic title with no surviving anchor — two "Lunch" entries where one
  survives in a different room at a different time — are reported as ambiguous rather than paired.
  That is deliberate: the alternative is guessing which one moved.

## Build log

The entries below cover substantive feature, bug-fix and test commits from the repository's Git history. Documentation-only, generated-types, CI and maintenance-only commits are omitted. The first commits on 2026-09-20 landed together as Parallel's initial public implementation push.

### 2026-09-20 - `28bafc5`

[app] Set up the Vite and React app with the shared design tokens.

### 2026-09-20 - `f0e70d9`

[app] Added the app shell: sidebar, mobile navigation and empty states that show no placeholder data.

### 2026-09-20 - `ac3764b`

[landing] Built landing page sections that tell the full story, beyond the hero.

### 2026-09-20 - `ff81909`

[convex] Defined the schema for the team plan, including the constraint revision guard.

### 2026-09-20 - `1a385d7`

[engine] Added the deterministic optimizer, with the coverage formula and constants fixed up front.

### 2026-09-20 - `48fbfbe`

[plan] Ran the optimizer inside the same mutation that writes the plan.

### 2026-09-20 - `a92f7fd`

[board] Added a seeded demo workspace and the queries the board reads.

### 2026-09-20 - `d4c20d5`

[board] Built the board's lanes, counters and stale-plan banner.

### 2026-09-20 - `47374ac`

[import] Turned a public agenda page into sessions that keep their provenance.

### 2026-09-20 - `e2e7ffe`

[scoring] Scored every session against the team's weighted goals.

### 2026-09-20 - `b326160`

[team] Added teammates, weighted goals and session preferences.

### 2026-09-20 - `b7a74af`

[email] Verified inbound webhook signatures before trusting a payload.

### 2026-09-20 - `9f135e5`

[email] Routed replies on the one shared inbox to the right teammate.

### 2026-09-20 - `e0ccd76`

[email] Applied a reply only when the model's quote is found word for word in the email.

### 2026-09-20 - `d9db13a`

[cover] Asked the best-placed teammate to cover a session and accepted their answer by email.

### 2026-09-20 - `1ae7491`

[app] Added placeholder routes for the agenda, goals, notes and brief screens.

### 2026-09-20 - `bce5d59`

[board] Wired the Release and Repair buttons to the mutations they name.

### 2026-09-20 - `9ba2cb5`

[convex] Added tables for the brief and for idempotent outbound sends.

### 2026-09-20 - `eab3959`

[guest] Added guest workspaces that can be reset and that expire.

### 2026-09-20 - `58174a3`

[email] Sent plan and cover emails, keyed so the same one is never sent twice.

### 2026-09-20 - `6c21bec`

[notes] Captured takeaways and found which teammates still owe one.

### 2026-09-20 - `37ccda0`

[brief] Wrote a brief grouped by goal that cannot cite anything it was not given.

### 2026-09-20 - `07164e9`

[setup] Built the screens for importing an agenda and setting the team's goals.

### 2026-09-20 - `f5992df`

[app] Recovered from a stale saved workspace instead of rendering nothing.

### 2026-09-20 - `befd7e6`

[plan] Made repair able to remove an assignment but never add one.

### 2026-09-20 - `c92f43e`

[landing] Removed the third-party CDN script behind the landing background.

### 2026-09-20 - `d64a2a4`

[knowledge] Built the screens for takeaways and the brief.

### 2026-09-20 - `6005a32`

[brief] Let the lead approve takeaways and choose who receives the brief.

### 2026-09-20 - `83cbd2c`

[knowledge] Let the lead hold a takeaway back and choose who the brief reaches.

### 2026-09-20 - `144999f`

[cover] Made the Ask button actually send the cover email.

### 2026-09-20 - `1768349`

[judges] Added one click that runs the whole loop on a fresh workspace.

### 2026-09-20 - `fdd2a6e`

[accessibility] Made the setup screens usable on a phone and by keyboard.

### 2026-09-20 - `06eae39`

[board] Stacked the lanes on a phone instead of requiring a sideways drag.

### 2026-09-20 - `57d64aa`

[agenda] Noticed when a published agenda changes and asked before acting on it.

### 2026-09-20 - `1b7b662`

[evidence] Let a judge follow any number back to its source.

### 2026-09-20 - `b188afe`

[engine] Proved a plan optimal when the search allows it, and said so when it could not.

### 2026-09-20 - `f9a6e9b`

[agenda] Watched published agendas on a schedule and on monitor notice.

### 2026-09-20 - `c10c298`

[firecrawl] Scraped agendas through the official Firecrawl Convex component.

### 2026-09-20 - `ba114cb`

[workflow] Ran the import as durable steps that survive a restart.

### 2026-09-20 - `53d57a2`

[scoring] Rescored only what actually changed.

### 2026-09-20 - `b881cb5`

[explain] Explained, with arithmetic, why one teammate was chosen over another.

### 2026-09-20 - `f1d1382`

[scoring] Made score reuse actually reuse scores rather than only measure that it could.

### 2026-09-20 - `629d5c1`

[agenda] Imported through the durable workflow and showed its progress on screen.

### 2026-09-20 - `1b3ba29`

[tests] Added adversarial tests that attack the guards instead of confirming them.

### 2026-09-20 - `9fac91e`

[email] Closed three ways a real reply could be silently lost or wrongly applied.

### 2026-09-20 - `43dc066`

[cover] Stopped accepting a cover into a plan that had moved on.

### 2026-09-20 - `7cf4dba`

[import] Refused an unusable timezone before any paid work started.

### 2026-09-20 - `bb363a9`

[email] Rendered a legacy bad timezone instead of throwing in the middle of a send.

### 2026-09-20 - `b20bc43`

[coverage] Stopped counting sessions nobody could physically attend.

### 2026-09-20 - `6f0b216`

[agenda] Told two sittings of the same talk apart.

### 2026-09-20 - `6ace047`

[agenda] Applied a confirmed agenda move to the stored session.

### 2026-09-20 - `1ff1da7`

[tests] Gave the exact-versus-brute-force comparison room to finish.

### 2026-09-21 - `9f58001`

[board] Opened a workspace straight from its URL.

### 2026-09-21 - `0d0be87`

[email] Matched a session by the words a teammate actually types.

### 2026-09-21 - `5393e40`

[board] Kept every teammate's lane on screen.

### 2026-09-21 - `e793e36`

[plan] Reported the coverage the saved repair actually achieved.

### 2026-09-21 - `9025a40`

[dependencies] Moved to the icon release whose file names match its own imports.

### 2026-09-21 - `94b7f0c`

[email] Turned a takeaway reply into a note on the session it names.

### 2026-09-21 - `27c40e2`

[cover] Broke ties between cover candidates by stated interest rather than by identifier.

### 2026-09-21 - `b107aac`

[email] Let a teammate pin a session by replying.

### 2026-09-21 - `46afe17`

[evidence] Let a person resolve a reply the parser could not place.

### 2026-09-21 - `c32e255`

[landing] Restored the animated background behind the hero.

### 2026-09-21 - `8f2b084`

[brief] Emailed the brief to the recipients the lead chose.

### 2026-09-21 - `ec68b44`

[import] Stopped reporting a short score matrix as a finished import.

### 2026-09-21 - `ab5a833`

[judges] Let anyone attack four guards live and watch them hold.

### 2026-09-21 - `b8cadf1`

[agenda] Retired a cancelled session instead of drawing it as live.

### 2026-09-21 - `5240e8d`

[email] Stopped filing a reply that only names a session as a takeaway.

### 2026-09-21 - `4b9ce22`

[brief] Stopped counting a rejected takeaway as captured.

### 2026-09-21 - `7c26869`

[judges] Led the judges page with the verified run and froze that run so it cannot drift.

### 2026-09-21 - `1efa3be`

[tests] Gave the brute-force property suites a time budget that fits their work.

### 2026-09-22 - `dc9c78a`

[board] Showed the day on each card when the agenda spans two days.

### 2026-09-22 - `b391804`

[judges] Answered, on screen, what zero-context testers could not.

### 2026-09-22 - `dada3fb`

[brief] Rate-limited brief generation per conference.

### 2026-09-22 - `088c021`

[email] Retried reply parsing through a brief OpenAI outage and made applying a reply idempotent, closing a path where re-parsing could mark an applied reply unhandled.

### 2026-09-22 - `31b0458`

[judges] Limited demo runs and agenda imports per browser, before any work starts.

### 2026-09-22 - `f69750d`

[email] Saved each reply and queued its parse in one write, repaired a missing parse on webhook redelivery, and kept a reply whose parsing failed on Evidence with a Retry parsing button.

### 2026-09-22 - `a6d7403`

[judges] Let a judge break a demo plan with an email of their own, through a one-use, hashed, `cant_attend`-only code that expires in two hours.

### 2026-09-22 - `332485f`

[privacy] Masked every email address that the public verified run's queries returned, and made two uncalled public queries internal.
