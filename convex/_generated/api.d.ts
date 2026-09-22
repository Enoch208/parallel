/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agendaSweep from "../agendaSweep.js";
import type * as agendaWatch from "../agendaWatch.js";
import type * as assignments from "../assignments.js";
import type * as board from "../board.js";
import type * as brief from "../brief.js";
import type * as constraints from "../constraints.js";
import type * as cover from "../cover.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as emailIngest from "../emailIngest.js";
import type * as emailReplies from "../emailReplies.js";
import type * as emailSend from "../emailSend.js";
import type * as emailSendWrites from "../emailSendWrites.js";
import type * as emailThreads from "../emailThreads.js";
import type * as engine_attendable from "../engine/attendable.js";
import type * as engine_beam from "../engine/beam.js";
import type * as engine_bounds from "../engine/bounds.js";
import type * as engine_constants from "../engine/constants.js";
import type * as engine_context from "../engine/context.js";
import type * as engine_counterfactual from "../engine/counterfactual.js";
import type * as engine_coverage from "../engine/coverage.js";
import type * as engine_disruption from "../engine/disruption.js";
import type * as engine_exact from "../engine/exact.js";
import type * as engine_feasibility from "../engine/feasibility.js";
import type * as engine_index from "../engine/index.js";
import type * as engine_intervals from "../engine/intervals.js";
import type * as engine_lookup from "../engine/lookup.js";
import type * as engine_objective from "../engine/objective.js";
import type * as engine_optimize from "../engine/optimize.js";
import type * as engine_planDiff from "../engine/planDiff.js";
import type * as engine_reasons from "../engine/reasons.js";
import type * as engine_searchPlan from "../engine/searchPlan.js";
import type * as engine_types from "../engine/types.js";
import type * as evidence from "../evidence.js";
import type * as explain from "../explain.js";
import type * as firecrawlJobs from "../firecrawlJobs.js";
import type * as frozen from "../frozen.js";
import type * as guest from "../guest.js";
import type * as http from "../http.js";
import type * as importAgenda from "../importAgenda.js";
import type * as importWorkflow from "../importWorkflow.js";
import type * as importWrites from "../importWrites.js";
import type * as judges from "../judges.js";
import type * as model_agendaDiff from "../model/agendaDiff.js";
import type * as model_agendaSchema from "../model/agendaSchema.js";
import type * as model_agendaSlice from "../model/agendaSlice.js";
import type * as model_agentmailClient from "../model/agentmailClient.js";
import type * as model_assignmentGuards from "../model/assignmentGuards.js";
import type * as model_briefSchema from "../model/briefSchema.js";
import type * as model_coverAcceptance from "../model/coverAcceptance.js";
import type * as model_coverRanking from "../model/coverRanking.js";
import type * as model_demoFixture from "../model/demoFixture.js";
import type * as model_firecrawlClient from "../model/firecrawlClient.js";
import type * as model_firecrawlComponent from "../model/firecrawlComponent.js";
import type * as model_frozenConference from "../model/frozenConference.js";
import type * as model_loadCoverInput from "../model/loadCoverInput.js";
import type * as model_loadOptimizerInput from "../model/loadOptimizerInput.js";
import type * as model_loadTripSummary from "../model/loadTripSummary.js";
import type * as model_monitorPayload from "../model/monitorPayload.js";
import type * as model_naturalPlan from "../model/naturalPlan.js";
import type * as model_openaiClient from "../model/openaiClient.js";
import type * as model_rateLimits from "../model/rateLimits.js";
import type * as model_replySchema from "../model/replySchema.js";
import type * as model_scoreFingerprint from "../model/scoreFingerprint.js";
import type * as model_scoringCompleteness from "../model/scoringCompleteness.js";
import type * as model_scoringSchema from "../model/scoringSchema.js";
import type * as model_sessionMatch from "../model/sessionMatch.js";
import type * as model_svix from "../model/svix.js";
import type * as model_takeawaySubstance from "../model/takeawaySubstance.js";
import type * as model_threadRouting from "../model/threadRouting.js";
import type * as model_timezone from "../model/timezone.js";
import type * as model_titleSimilarity from "../model/titleSimilarity.js";
import type * as model_types from "../model/types.js";
import type * as model_webhookPayload from "../model/webhookPayload.js";
import type * as model_workpools from "../model/workpools.js";
import type * as model_zonedTime from "../model/zonedTime.js";
import type * as notes from "../notes.js";
import type * as plan from "../plan.js";
import type * as reliability from "../reliability.js";
import type * as scoring from "../scoring.js";
import type * as scoringReuse from "../scoringReuse.js";
import type * as team from "../team.js";
import type * as uncovered from "../uncovered.js";
import type * as verifiedRun from "../verifiedRun.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agendaSweep: typeof agendaSweep;
  agendaWatch: typeof agendaWatch;
  assignments: typeof assignments;
  board: typeof board;
  brief: typeof brief;
  constraints: typeof constraints;
  cover: typeof cover;
  crons: typeof crons;
  demo: typeof demo;
  emailIngest: typeof emailIngest;
  emailReplies: typeof emailReplies;
  emailSend: typeof emailSend;
  emailSendWrites: typeof emailSendWrites;
  emailThreads: typeof emailThreads;
  "engine/attendable": typeof engine_attendable;
  "engine/beam": typeof engine_beam;
  "engine/bounds": typeof engine_bounds;
  "engine/constants": typeof engine_constants;
  "engine/context": typeof engine_context;
  "engine/counterfactual": typeof engine_counterfactual;
  "engine/coverage": typeof engine_coverage;
  "engine/disruption": typeof engine_disruption;
  "engine/exact": typeof engine_exact;
  "engine/feasibility": typeof engine_feasibility;
  "engine/index": typeof engine_index;
  "engine/intervals": typeof engine_intervals;
  "engine/lookup": typeof engine_lookup;
  "engine/objective": typeof engine_objective;
  "engine/optimize": typeof engine_optimize;
  "engine/planDiff": typeof engine_planDiff;
  "engine/reasons": typeof engine_reasons;
  "engine/searchPlan": typeof engine_searchPlan;
  "engine/types": typeof engine_types;
  evidence: typeof evidence;
  explain: typeof explain;
  firecrawlJobs: typeof firecrawlJobs;
  frozen: typeof frozen;
  guest: typeof guest;
  http: typeof http;
  importAgenda: typeof importAgenda;
  importWorkflow: typeof importWorkflow;
  importWrites: typeof importWrites;
  judges: typeof judges;
  "model/agendaDiff": typeof model_agendaDiff;
  "model/agendaSchema": typeof model_agendaSchema;
  "model/agendaSlice": typeof model_agendaSlice;
  "model/agentmailClient": typeof model_agentmailClient;
  "model/assignmentGuards": typeof model_assignmentGuards;
  "model/briefSchema": typeof model_briefSchema;
  "model/coverAcceptance": typeof model_coverAcceptance;
  "model/coverRanking": typeof model_coverRanking;
  "model/demoFixture": typeof model_demoFixture;
  "model/firecrawlClient": typeof model_firecrawlClient;
  "model/firecrawlComponent": typeof model_firecrawlComponent;
  "model/frozenConference": typeof model_frozenConference;
  "model/loadCoverInput": typeof model_loadCoverInput;
  "model/loadOptimizerInput": typeof model_loadOptimizerInput;
  "model/loadTripSummary": typeof model_loadTripSummary;
  "model/monitorPayload": typeof model_monitorPayload;
  "model/naturalPlan": typeof model_naturalPlan;
  "model/openaiClient": typeof model_openaiClient;
  "model/rateLimits": typeof model_rateLimits;
  "model/replySchema": typeof model_replySchema;
  "model/scoreFingerprint": typeof model_scoreFingerprint;
  "model/scoringCompleteness": typeof model_scoringCompleteness;
  "model/scoringSchema": typeof model_scoringSchema;
  "model/sessionMatch": typeof model_sessionMatch;
  "model/svix": typeof model_svix;
  "model/takeawaySubstance": typeof model_takeawaySubstance;
  "model/threadRouting": typeof model_threadRouting;
  "model/timezone": typeof model_timezone;
  "model/titleSimilarity": typeof model_titleSimilarity;
  "model/types": typeof model_types;
  "model/webhookPayload": typeof model_webhookPayload;
  "model/workpools": typeof model_workpools;
  "model/zonedTime": typeof model_zonedTime;
  notes: typeof notes;
  plan: typeof plan;
  reliability: typeof reliability;
  scoring: typeof scoring;
  scoringReuse: typeof scoringReuse;
  team: typeof team;
  uncovered: typeof uncovered;
  verifiedRun: typeof verifiedRun;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  scoringPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"scoringPool">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
