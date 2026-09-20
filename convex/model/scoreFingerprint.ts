export const scoringSchemaVersion = "scores.v1";

export interface FingerprintInput {
  readonly sessionTitle: string;
  readonly sessionTrack: string | null;
  readonly sessionRoom: string | null;
  readonly speakers: readonly string[];
  readonly goalLabel: string;
  readonly model: string;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function scoreFingerprint(input: FingerprintInput): string {
  const parts = [
    scoringSchemaVersion,
    input.model,
    normalize(input.goalLabel),
    normalize(input.sessionTitle),
    normalize(input.sessionTrack ?? ""),
    normalize(input.sessionRoom ?? ""),
    input.speakers.map(normalize).sort().join(","),
  ];

  return parts.join("|");
}

export interface ReuseDecision {
  readonly reused: number;
  readonly toScore: readonly string[];
}

export function planReuse(
  wanted: ReadonlyMap<string, string>,
  existing: ReadonlyMap<string, string>,
): ReuseDecision {
  const toScore: string[] = [];
  let reused = 0;

  for (const [pairKey, fingerprint] of wanted) {
    const current = existing.get(pairKey);

    if (current !== undefined && current === fingerprint) {
      reused += 1;
    } else {
      toScore.push(pairKey);
    }
  }

  return { reused, toScore };
}
