import type { SessionConfidence } from "./types";

export const demoGoalKeys = ["priorAuth", "payerPartnerships", "aiScribes", "compliance"] as const;
export type DemoGoalKey = (typeof demoGoalKeys)[number];

export interface DemoGoal {
  readonly key: DemoGoalKey;
  readonly label: string;
  readonly weight: number;
}

export interface DemoMember {
  readonly displayName: string;
  readonly email: string;
  readonly isLead: boolean;
}

export interface DemoScore {
  readonly relevance: number;
  readonly reason: string;
}

export interface DemoSession {
  readonly externalKey: string;
  readonly title: string;
  readonly track: string;
  readonly room: string;
  readonly speakers: readonly string[];
  readonly startsAt: number;
  readonly endsAt: number;
  readonly titleConfidence: SessionConfidence;
  readonly timeConfidence: SessionConfidence;
  readonly roomConfidence: SessionConfidence;
  readonly scores: Readonly<Record<DemoGoalKey, DemoScore>>;
}

const demoDay = { year: 2026, monthIndex: 10, dayOfMonth: 16 } as const;
const pacificStandardOffsetHours = 8;

const atPacific = (hour: number, minute: number): number =>
  Date.UTC(
    demoDay.year,
    demoDay.monthIndex,
    demoDay.dayOfMonth,
    hour + pacificStandardOffsetHours,
    minute,
  );

const score = (relevance: number, reason: string): DemoScore => ({ relevance, reason });

export const demoScoreModel = "seeded-demo-fixture (no model call)";

export const demoTeamName = "Meridian Health Group";

export const demoConference = {
  name: "Vantage Health Summit 2026",
  agendaUrl: "https://agenda.vantagehealthsummit.example.com/2026/day-one",
  timezone: "America/Los_Angeles",
  constraintRevision: 0,
} as const;

export const demoSource = {
  url: demoConference.agendaUrl,
  fetchedAt: Date.UTC(2026, 9, 2, 16, 12, 0),
  contentHash: "sha256:demo-fixture-vantage-health-2026-day-one",
} as const;

export const demoMembers: readonly DemoMember[] = [
  { displayName: "Priya Raman", email: "priya.raman@example.com", isLead: true },
  { displayName: "Daniel Okafor", email: "daniel.okafor@example.com", isLead: false },
  { displayName: "Sofia Marchetti", email: "sofia.marchetti@example.com", isLead: false },
  { displayName: "Wes Tanaka", email: "wes.tanaka@example.com", isLead: false },
];

export const demoGoals: readonly DemoGoal[] = [
  { key: "priorAuth", label: "Prior authorization automation", weight: 5 },
  { key: "payerPartnerships", label: "Payer partnerships", weight: 4 },
  { key: "aiScribes", label: "AI scribes", weight: 3 },
  { key: "compliance", label: "Compliance and audit readiness", weight: 3 },
];

export const demoStackedSessionKeys: readonly string[] = [
  "vhs-keynote",
  "vhs-fireside-payer",
  "vhs-appeals-demo",
];

export const demoSessions: readonly DemoSession[] = [
  {
    externalKey: "vhs-keynote",
    title: "Opening Keynote: Where Health Dollars Move in 2027",
    track: "Main Stage",
    room: "Murano Theatre",
    speakers: ["Dr. Alana Reyes", "Marcus Webb"],
    startsAt: atPacific(9, 0),
    endsAt: atPacific(10, 0),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.3, "Names auth spend as a cost line, no build detail"),
      payerPartnerships: score(0.62, "Frames what payers will fund next year"),
      aiScribes: score(0.28, "Documentation burden gets one slide"),
      compliance: score(0.35, "Sets the regulatory backdrop for the day"),
    },
  },
  {
    externalKey: "vhs-denial-workshop",
    title: "Workshop: Mapping a Prior Authorization Denial, Step by Step",
    track: "Payer and Reimbursement",
    room: "Palazzo 3",
    speakers: ["Renata Oyelaran"],
    startsAt: atPacific(9, 0),
    endsAt: atPacific(10, 0),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.94, "Walks the denial path automation has to replace"),
      payerPartnerships: score(0.55, "Shows where payer teams sit in that path"),
      aiScribes: score(0.12, "No documentation tooling content"),
      compliance: score(0.45, "Covers appeal deadlines and record retention"),
    },
  },
  {
    externalKey: "vhs-fireside-payer",
    title: "Fireside: What Three National Payers Want From Startups",
    track: "Main Stage",
    room: "Murano Theatre",
    speakers: ["Joanna Feld", "Ibrahim Saleh"],
    startsAt: atPacific(10, 15),
    endsAt: atPacific(11, 15),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.5, "Auth automation comes up as a buying priority"),
      payerPartnerships: score(0.93, "Direct account of how payers pick partners"),
      aiScribes: score(0.2, "Scribes appear only as a budget comparison"),
      compliance: score(0.4, "Vendor review expectations are described"),
    },
  },
  {
    externalKey: "vhs-auth-apis",
    title: "Building Real-Time Benefit and Auth APIs on FHIR",
    track: "Payer and Reimbursement",
    room: "Palazzo 3",
    speakers: ["Nadia Brandt"],
    startsAt: atPacific(10, 15),
    endsAt: atPacific(11, 15),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.88, "The integration surface an auth bot has to call"),
      payerPartnerships: score(0.7, "Needs a payer data agreement to ship"),
      aiScribes: score(0.15, "Unrelated to ambient documentation"),
      compliance: score(0.5, "Covers consent scopes on shared benefit data"),
    },
  },
  {
    externalKey: "vhs-scribe-rollout",
    title: "Rolling Out Ambient Scribes Across 40 Clinics",
    track: "Clinical AI",
    room: "Bellini 2",
    speakers: ["Dr. Kofi Mensah", "Laura Whitfield"],
    startsAt: atPacific(10, 15),
    endsAt: atPacific(11, 15),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.25, "Notes feed auth packets, but only in passing"),
      payerPartnerships: score(0.18, "No payer contracting content"),
      aiScribes: score(0.95, "A full multi-site rollout postmortem"),
      compliance: score(0.48, "Consent capture at the bedside is covered"),
    },
  },
  {
    externalKey: "vhs-hipaa-questionnaire",
    title: "HIPAA and the AI Vendor Questionnaire",
    track: "Policy and Compliance",
    room: "Veneto 1",
    speakers: ["Gabriel Ustinov"],
    startsAt: atPacific(10, 15),
    endsAt: atPacific(11, 15),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "low",
    scores: {
      priorAuth: score(0.3, "Applies to auth vendors like any other"),
      payerPartnerships: score(0.3, "Touches payer data sharing terms"),
      aiScribes: score(0.45, "Scribe vendors are the worked example"),
      compliance: score(0.96, "The questionnaire a security review has to pass"),
    },
  },
  {
    externalKey: "vhs-appeals-demo",
    title: "Live Demo: Denials Overturned by Automated Appeals",
    track: "Main Stage",
    room: "Murano Theatre",
    speakers: ["Priscilla Danjuma"],
    startsAt: atPacific(11, 30),
    endsAt: atPacific(12, 30),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.97, "Exactly the appeal automation we came to see"),
      payerPartnerships: score(0.6, "Shows how payer responses are handled"),
      aiScribes: score(0.2, "Notes used as evidence, nothing more"),
      compliance: score(0.5, "Audit trail on each generated appeal"),
    },
  },
  {
    externalKey: "vhs-contracting-clinic",
    title: "Contracting Clinic: Getting Past the Payer Pilot",
    track: "Payer and Reimbursement",
    room: "Palazzo 3",
    speakers: ["Joanna Feld"],
    startsAt: atPacific(11, 30),
    endsAt: atPacific(12, 30),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.4, "Auth pilots are the running example"),
      payerPartnerships: score(0.92, "A contracting playbook for payer pilots"),
      aiScribes: score(0.15, "No scribe content"),
      compliance: score(0.42, "Covers the security review inside contracting"),
    },
  },
  {
    externalKey: "vhs-scribe-accuracy",
    title: "Measuring Scribe Accuracy Without a Gold Standard",
    track: "Clinical AI",
    room: "Bellini 2",
    speakers: ["Dr. Kofi Mensah"],
    startsAt: atPacific(11, 30),
    endsAt: atPacific(12, 30),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.2, "The accuracy method does not transfer to auth"),
      payerPartnerships: score(0.12, "No payer angle"),
      aiScribes: score(0.9, "The evaluation method our team lacks today"),
      compliance: score(0.4, "Documents what to log for an audit"),
    },
  },
  {
    externalKey: "vhs-intake-eligibility",
    title: "Rebuilding Patient Intake Around Eligibility Checks",
    track: "Digital Health Operations",
    room: "Lido 4",
    speakers: ["Meera Chandrasekar", "Tom Verhoeven"],
    startsAt: atPacific(11, 30),
    endsAt: atPacific(12, 30),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "low",
    scores: {
      priorAuth: score(0.72, "Eligibility is the first gate before auth"),
      payerPartnerships: score(0.55, "Eligibility data comes straight from payers"),
      aiScribes: score(0.22, "Intake notes only"),
      compliance: score(0.35, "Consent captured at registration"),
    },
  },
  {
    externalKey: "vhs-gold-carding",
    title: "Gold Carding and the End of Manual Prior Auth",
    track: "Payer and Reimbursement",
    room: "Palazzo 3",
    speakers: ["Renata Oyelaran", "Ibrahim Saleh"],
    startsAt: atPacific(13, 30),
    endsAt: atPacific(14, 30),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.93, "Gold carding changes what is worth automating"),
      payerPartnerships: score(0.75, "Gold carding is negotiated with payers"),
      aiScribes: score(0.15, "No documentation tooling"),
      compliance: score(0.6, "State mandates on auth turnaround are covered"),
    },
  },
  {
    externalKey: "vhs-clinician-feedback",
    title: "What Clinicians Actually Say About Scribes",
    track: "Clinical AI",
    room: "Bellini 2",
    speakers: ["Laura Whitfield"],
    startsAt: atPacific(13, 30),
    endsAt: atPacific(14, 30),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.15, "No auth workflow content"),
      payerPartnerships: score(0.1, "No payer content"),
      aiScribes: score(0.88, "Buyer objections straight from clinicians"),
      compliance: score(0.3, "Consent friction shows up in the feedback"),
    },
  },
  {
    externalKey: "vhs-audit-logging",
    title: "Audit-Ready Logging for Clinical AI",
    track: "Policy and Compliance",
    room: "Veneto 1",
    speakers: ["Gabriel Ustinov", "Amara Nwosu"],
    startsAt: atPacific(13, 30),
    endsAt: atPacific(14, 30),
    titleConfidence: "high",
    timeConfidence: "low",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.45, "Applies to automated auth decisions too"),
      payerPartnerships: score(0.2, "Payer audits get a brief mention"),
      aiScribes: score(0.5, "Scribe logs are one of the examples"),
      compliance: score(0.94, "The logging bar an auditor will ask for"),
    },
  },
  {
    externalKey: "vhs-revenue-cycle-staffing",
    title: "Staffing the Revenue Cycle When Volume Doubles",
    track: "Digital Health Operations",
    room: "Lido 4",
    speakers: ["Tom Verhoeven"],
    startsAt: atPacific(13, 30),
    endsAt: atPacific(14, 30),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
    scores: {
      priorAuth: score(0.6, "Auth backlog is the staffing pressure point"),
      payerPartnerships: score(0.4, "Payer mix drives the staffing model"),
      aiScribes: score(0.3, "Scribes cited as a capacity lever"),
      compliance: score(0.25, "Little compliance content"),
    },
  },
];
