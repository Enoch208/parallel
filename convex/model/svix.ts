function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export const signatureToleranceMs = 5 * 60 * 1000;

export interface SvixHeaders {
  readonly id: string | null;
  readonly timestamp: string | null;
  readonly signature: string | null;
}

export async function verifySvixSignature(
  body: string,
  headers: SvixHeaders,
  secret: string,
  now: number,
): Promise<boolean> {
  if (headers.id === null || headers.timestamp === null || headers.signature === null) {
    return false;
  }

  const sentAt = Number(headers.timestamp) * 1000;

  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > signatureToleranceMs) {
    return false;
  }

  const rawSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(rawSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = `${headers.id}.${headers.timestamp}.${body}`;
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = bytesToBase64(new Uint8Array(digest));

  return headers.signature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice("v1,".length) : ""))
    .some((candidate) => candidate.length > 0 && timingSafeEqual(candidate, expected));
}
