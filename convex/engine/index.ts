export {
  BEAM_WIDTH,
  DUPLICATE_ATTENDANCE_PENALTY,
  INTEREST_BONUS,
  RELEVANCE_ABSORPTION,
  REPAIR_CHANGE_PENALTY,
} from "./constants";
export { objectiveUpperBound } from "./bounds";
export { computeCoverageSummary } from "./coverage";
export {
  canSolveExactly,
  EXACT_NODE_BUDGET,
  EXACT_SEARCH_LOG2_LIMIT,
  optimizePlanWithProof,
  repairPlanWithProof,
} from "./exact";
export { blockingPinnedSessionIds, findPinConflicts } from "./feasibility";
export { groupSessionIndicesByWindow, overlaps, sortedSessions } from "./intervals";
export { scoreAssignments } from "./objective";
export { optimizePlan, repairPlan } from "./optimize";
export { countMovedAssignments } from "./planDiff";
export type {
  AvailabilityBlockSummary,
  CoverageInput,
  InfeasibleOutcome,
  MemberPreferenceSummary,
  MemberStance,
  MemberSummary,
  ObjectiveBreakdown,
  OptimizeOutcome,
  OptimizerInput,
  PinConflict,
  PinConflictKind,
  PlanOutcome,
  ProvenOutcome,
  ProvenPlanOutcome,
  SolutionStatus,
} from "./types";
export { memberStance, pinConflictKind, solutionStatus } from "./types";
