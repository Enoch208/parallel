export interface ScoringCounts {
  readonly sessions: number;
  readonly goals: number;
  readonly scoredPairs: number;
}

export interface ScoringCompleteness {
  readonly expectedPairs: number;
  readonly scoredPairs: number;
  readonly missing: number;
  readonly complete: boolean;
}

export function assessScoring(counts: ScoringCounts): ScoringCompleteness {
  const expectedPairs = counts.sessions * counts.goals;
  const missing = Math.max(0, expectedPairs - counts.scoredPairs);

  return { expectedPairs, scoredPairs: counts.scoredPairs, missing, complete: missing === 0 };
}

export function describeScoring(result: ScoringCompleteness, retried: boolean): string {
  if (result.complete) {
    return `Scored all ${String(result.expectedPairs)} session and goal pairs`;
  }

  const attempt = retried ? " after a retry" : "";
  return `Scored ${String(result.scoredPairs)} of ${String(result.expectedPairs)} session and goal pairs${attempt}; ${String(result.missing)} left unscored count as zero relevance`;
}
