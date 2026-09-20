import { WorkflowManager } from "@convex-dev/workflow";
import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const importWorkflows = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 4,
    retryActionsByDefault: false,
    defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 1_000, base: 2 },
  },
});

export const scoringPool = new Workpool(components.scoringPool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 4_000, base: 2 },
});
