import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const confidence = v.union(v.literal("high"), v.literal("low"));

export default defineSchema({
  teams: defineTable({
    name: v.string(),
    isDemo: v.boolean(),
  }),

  memberships: defineTable({
    teamId: v.id("teams"),
    displayName: v.string(),
    email: v.string(),
    isLead: v.boolean(),
  })
    .index("by_team", ["teamId"])
    .index("by_email", ["email"]),

  conferences: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    agendaUrl: v.string(),
    timezone: v.string(),
    constraintRevision: v.number(),
    isDemoData: v.boolean(),
    dayMarker: v.optional(v.union(v.string(), v.null())),
  }).index("by_team", ["teamId"]),

  sources: defineTable({
    conferenceId: v.id("conferences"),
    url: v.string(),
    fetchedAt: v.number(),
    contentHash: v.string(),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_url", ["url"]),

  sessions: defineTable({
    conferenceId: v.id("conferences"),
    sourceId: v.id("sources"),
    externalKey: v.string(),
    title: v.string(),
    track: v.union(v.string(), v.null()),
    room: v.union(v.string(), v.null()),
    speakers: v.array(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    titleConfidence: confidence,
    timeConfidence: confidence,
    roomConfidence: confidence,
  })
    .index("by_conference", ["conferenceId"])
    .index("by_conference_start", ["conferenceId", "startsAt"])
    .index("by_external_key", ["conferenceId", "externalKey"]),

  goals: defineTable({
    conferenceId: v.id("conferences"),
    label: v.string(),
    weight: v.number(),
  }).index("by_conference", ["conferenceId"]),

  sessionGoalScores: defineTable({
    conferenceId: v.id("conferences"),
    sessionId: v.id("sessions"),
    goalId: v.id("goals"),
    relevance: v.number(),
    reason: v.string(),
    model: v.string(),
    inputFingerprint: v.optional(v.string()),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_session", ["sessionId"]),

  memberPreferences: defineTable({
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    sessionId: v.id("sessions"),
    stance: v.union(v.literal("interested"), v.literal("avoid"), v.literal("pinned")),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_member", ["conferenceId", "membershipId"]),

  availabilityBlocks: defineTable({
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.string(),
    sourceQuote: v.union(v.string(), v.null()),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_member", ["conferenceId", "membershipId"]),

  plans: defineTable({
    conferenceId: v.id("conferences"),
    computedAtRevision: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("stale"),
      v.literal("infeasible"),
    ),
    blockingPins: v.array(v.id("sessions")),
    computedAt: v.number(),
    solverStatus: v.optional(v.union(v.literal("optimal"), v.literal("heuristic"))),
    objective: v.optional(v.number()),
    upperBound: v.optional(v.number()),
    nodesExplored: v.optional(v.number()),
    minimumChangedMembers: v.optional(v.number()),
    mustChangeMemberIds: v.optional(v.array(v.id("memberships"))),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_conference_computed", ["conferenceId", "computedAt"]),

  assignments: defineTable({
    planId: v.id("plans"),
    conferenceId: v.id("conferences"),
    sessionId: v.id("sessions"),
    membershipId: v.id("memberships"),
    pinned: v.boolean(),
    reason: v.string(),
  })
    .index("by_plan", ["planId"])
    .index("by_plan_member", ["planId", "membershipId"])
    .index("by_session", ["sessionId"]),

  emailThreads: defineTable({
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    providerThreadId: v.union(v.string(), v.null()),
    token: v.string(),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_token", ["token"])
    .index("by_provider_thread", ["providerThreadId"]),

  emailEvents: defineTable({
    conferenceId: v.union(v.id("conferences"), v.null()),
    providerEventId: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    kind: v.string(),
    membershipId: v.union(v.id("memberships"), v.null()),
    subject: v.string(),
    body: v.string(),
    intent: v.union(v.string(), v.null()),
    confidence: v.union(v.number(), v.null()),
    quote: v.union(v.string(), v.null()),
    fromAddress: v.string(),
    rawPayload: v.optional(v.string()),
    handled: v.boolean(),
    resolvedByHand: v.optional(v.boolean()),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_provider_event", ["providerEventId"])
    .index("by_conference_handled", ["conferenceId", "handled"]),

  coverRequests: defineTable({
    conferenceId: v.id("conferences"),
    planId: v.id("plans"),
    sessionId: v.id("sessions"),
    fromMember: v.id("memberships"),
    toMember: v.id("memberships"),
    coverageGain: v.number(),
    status: v.union(
      v.literal("proposed"),
      v.literal("asked"),
      v.literal("accepted"),
      v.literal("declined"),
    ),
    reasons: v.array(v.string()),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_conference_status", ["conferenceId", "status"]),

  notes: defineTable({
    conferenceId: v.id("conferences"),
    sessionId: v.id("sessions"),
    membershipId: v.id("memberships"),
    body: v.string(),
    source: v.union(v.literal("email"), v.literal("app")),
    approved: v.optional(v.boolean()),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_session", ["sessionId"]),

  briefRecipients: defineTable({
    conferenceId: v.id("conferences"),
    email: v.string(),
    addedBy: v.id("memberships"),
  }).index("by_conference", ["conferenceId"]),

  briefs: defineTable({
    conferenceId: v.id("conferences"),
    body: v.string(),
    model: v.string(),
    recipients: v.array(v.string()),
    tripCostEstimate: v.union(v.number(), v.null()),
    sentAt: v.union(v.number(), v.null()),
  }).index("by_conference", ["conferenceId"]),

  outboundSends: defineTable({
    conferenceId: v.id("conferences"),
    membershipId: v.union(v.id("memberships"), v.null()),
    kind: v.string(),
    planRevision: v.number(),
    idempotencyKey: v.string(),
    providerMessageId: v.union(v.string(), v.null()),
    sentAt: v.number(),
  })
    .index("by_conference", ["conferenceId"])
    .index("by_idempotency", ["idempotencyKey"]),

  activity: defineTable({
    conferenceId: v.id("conferences"),
    kind: v.string(),
    sponsor: v.union(
      v.literal("firecrawl"),
      v.literal("openai"),
      v.literal("agentmail"),
      v.literal("convex"),
    ),
    durationMs: v.number(),
    summary: v.string(),
  }).index("by_conference", ["conferenceId"]),
});
