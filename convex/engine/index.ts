export {
  BEAM_WIDTH,
  DUPLICATE_ATTENDANCE_PENALTY,
  INTEREST_BONUS,
  RELEVANCE_ABSORPTION,
  REPAIR_CHANGE_PENALTY,
} from "./constants";
export { computeCoverageSummary } from "./coverage";
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
} from "./types";
export { memberStance, pinConflictKind } from "./types";
