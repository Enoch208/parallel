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

| Sponsor       | What it does here                                                                                                                                               | Where                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Convex**    | Database, reactive queries, the optimizer inside the mutation that writes the plan, the revision guard, the webhook endpoint, crons, and the static site itself | `convex/plan.ts`, `convex/assignments.ts`, `convex/http.ts` |
| **Firecrawl** | Scrapes the public agenda page; every session keeps its source URL, fetch time and content hash                                                                 | `convex/model/firecrawlClient.ts`                           |
| **OpenAI**    | Normalizes scraped markdown into sessions, scores each session against the team's goals, parses email replies, and writes the brief                             | `convex/model/openaiClient.ts`                              |
| **AgentMail** | One shared inbox: plan emails out, replies in through a signature-verified webhook, cover requests and the brief                                                | `convex/model/agentmailClient.ts`, `convex/http.ts`         |

## What is real and what is demo data

Real, on the live deployment right now:

- **9 sessions imported from a real public agenda** (ViVE, a health-tech conference), each with its
  source link, scraped and normalized end to end.
- **540 relevance scores** produced by real model calls; every row records the model that made it.
- **6 inbound email events**, including a reply sent from Gmail that travelled the whole chain:
  signature verified, routed by subject token, parsed, and applied to the board.
- **8 outbound emails** actually delivered through AgentMail.
- **4 takeaways** and a generated brief in which every claim cites a note that was handed to the
  model.

Demo data is labelled as demo data in the interface. The seeded demo conference is a fictional
event on a reserved example domain, so no invented agenda is ever attributed to a real organizer.

Counters read `—` until a real value exists. No number in this product is typed in except the trip
cost estimate, which the team lead enters and which is captioned as their own figure.

## Convex map

| Feature                      | File                                     | What a user sees                                                                              |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Optimizer inside a mutation  | `convex/plan.ts`                         | Press Optimize; the plan is written in one transaction with the constraints it was built from |
| Revision guard               | `convex/assignments.ts`                  | A stale write is refused: "The plan changed while you were looking at it"                     |
| Coverage as a reactive query | `convex/plan.ts`                         | Counters move the moment anyone claims or releases                                            |
| Verified webhook             | `convex/http.ts`, `convex/model/svix.ts` | Replying to a plan email turns the board amber                                                |
| Idempotent sends             | `convex/emailSendWrites.ts`              | Re-running a send delivers nothing twice                                                      |
| Scheduler and crons          | `convex/crons.ts`                        | Takeaway prompts become due when a session ends                                               |
| Guest workspaces             | `convex/guest.ts`                        | Your clicks never change another visitor's board                                              |

## What the solver actually proves

Two modes, and the product says which one it used. On a small enough instance a branch-and-bound
search explores the whole space and reports **proven optimal**. On a larger one it reports the best
plan it found together with a mathematically derived upper bound, so the most it could be wrong by
is stated rather than hidden.

The engine is verified by randomized property testing rather than a handful of fixtures: **2,000
generated instances** with zero violations of the hard constraints, **438 exact-versus-brute-force
comparisons** with zero disagreements, and determinism checked over 400 instances run twice. The
tests also found that beam search alone is genuinely suboptimal on a measurable share of instances,
which is why the exact mode exists.

## Known issues

- On a large agenda the solver runs out of search budget and reports "best found, not proven
  optimal" with the size of the gap, rather than claiming an optimum it has not proved. The demo
  agenda is just past that threshold.
- The optimizer will leave a teammate free rather than create duplicate attendance that adds no
  coverage. The lane says so, and anyone can take a session from it by hand.
- A send accepted by the email provider whose response never reaches us would be retried, so
  at-least-once delivery is possible in that narrow window.
