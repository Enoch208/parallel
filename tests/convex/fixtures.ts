import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";
import type { MutationCtx } from "../../convex/_generated/server";

const globbed: Record<string, () => Promise<unknown>> = {
  ...import.meta.glob("../../convex/**/*.ts"),
  ...import.meta.glob("../../convex/_generated/*.js"),
};

export const convexModules = Object.fromEntries(
  Object.entries(globbed).filter(([path]) => !path.endsWith(".d.ts")),
);

export const HOUR = 60 * 60 * 1000;
export const BASE = Date.UTC(2026, 8, 22, 9, 0, 0);

export interface ExtraSession {
  readonly conferenceId: Id<"conferences">;
  readonly title: string;
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface CoverFixture {
  readonly sourceId: Id<"sources">;
  readonly conferenceId: Id<"conferences">;
  readonly planId: Id<"plans">;
  readonly droppedSessionId: Id<"sessions">;
  readonly clashingSessionId: Id<"sessions">;
  readonly leaverId: Id<"memberships">;
  readonly covererId: Id<"memberships">;
  readonly bystanderId: Id<"memberships">;
  readonly requestId: Id<"coverRequests">;
}

export function freshHarness() {
  const t = convexTest(schema, convexModules);
  rateLimiterTest.register(t);
  return t;
}

export async function seedCoverScenario(
  ctx: MutationCtx,
  options: { coverRequestStatus?: "proposed" | "asked" | "accepted" | "declined" } = {},
): Promise<CoverFixture> {
  const db = ctx.db;
  const teamId = await db.insert("teams", { name: "Platform", isDemo: false });

  const member = async (displayName: string, email: string, isLead: boolean) =>
    db.insert("memberships", { teamId, displayName, email, isLead });

  const leaverId = await member("Ada", "ada@example.com", true);
  const covererId = await member("Grace", "grace@example.com", false);
  const bystanderId = await member("Linus", "linus@example.com", false);

  const conferenceId = await db.insert("conferences", {
    teamId,
    name: "All Gas 2026",
    agendaUrl: "https://example.com/agenda",
    timezone: "UTC",
    constraintRevision: 4,
    isDemoData: false,
    dayMarker: null,
  });

  const sourceId = await db.insert("sources", {
    conferenceId,
    url: "https://example.com/agenda",
    fetchedAt: BASE,
    contentHash: "hash",
  });

  const session = async (title: string, startsAt: number, endsAt: number) =>
    await db.insert("sessions", {
      conferenceId,
      sourceId,
      externalKey: `${title}@${String(startsAt)}`,
      title,
      track: null,
      room: null,
      speakers: [],
      startsAt,
      endsAt,
      titleConfidence: "high",
      timeConfidence: "high",
      roomConfidence: "high",
    });

  const droppedSessionId = await session("Durable Workflows", BASE, BASE + HOUR);
  const clashingSessionId = await session("Vector Search", BASE + HOUR / 2, BASE + HOUR * 2);

  const planId = await db.insert("plans", {
    conferenceId,
    computedAtRevision: 4,
    status: "draft",
    blockingPins: [],
    computedAt: BASE,
  });

  const requestId = await db.insert("coverRequests", {
    conferenceId,
    planId,
    sessionId: droppedSessionId,
    fromMember: leaverId,
    toMember: covererId,
    coverageGain: 2.5,
    status: options.coverRequestStatus ?? "asked",
    reasons: ["Closest match to the team goal that went uncovered"],
  });

  return {
    sourceId,
    conferenceId,
    planId,
    droppedSessionId,
    clashingSessionId,
    leaverId,
    covererId,
    bystanderId,
    requestId,
  };
}

export async function addSession(
  ctx: MutationCtx,
  fixture: CoverFixture,
  title: string,
  startsAt: number,
): Promise<Id<"sessions">> {
  return ctx.db.insert("sessions", {
    conferenceId: fixture.conferenceId,
    sourceId: fixture.sourceId,
    externalKey: `${title}@${String(startsAt)}`,
    title,
    track: null,
    room: null,
    speakers: [],
    startsAt,
    endsAt: startsAt + HOUR,
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
  });
}
