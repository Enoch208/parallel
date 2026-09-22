const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tokenLength = 26;
const tokenPattern = /\[JD-([A-HJ-NP-Z2-9]{26})\]/i;

export const judgeTokenLifetimeMs = 2 * 60 * 60 * 1000;

export function mintJudgeToken(): string {
  const bytes = new Uint8Array(tokenLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet.charAt(byte % alphabet.length)).join("");
}

export function judgeSubjectTag(token: string): string {
  return `[JD-${token}]`;
}

export function judgeTokenIn(subject: string): string | null {
  const token = tokenPattern.exec(subject)?.[1];
  return token === undefined ? null : token.toUpperCase();
}

export function redactJudgeToken(text: string): string {
  return text.replace(new RegExp(tokenPattern.source, "gi"), "[JD-redacted]");
}

export async function hashJudgeToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function maskAddress(address: string): string {
  const at = address.indexOf("@");
  return at <= 0 ? "a hidden address" : `${address.charAt(0)}•••${address.slice(at)}`;
}
