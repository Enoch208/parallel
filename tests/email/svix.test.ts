import { describe, expect, it } from "vitest";
import { verifySvixSignature, signatureToleranceMs } from "../../convex/model/svix";

const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const body = JSON.stringify({ type: "message.received", data: { id: "msg_1" } });
const id = "msg_2f3b";

async function sign(payload: string, messageId: string, timestamp: string): Promise<string> {
  const raw = secret.slice("whsec_".length);
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${messageId}.${timestamp}.${payload}`),
  );

  let out = "";
  for (const byte of new Uint8Array(digest)) out += String.fromCharCode(byte);

  return `v1,${btoa(out)}`;
}

describe("verifySvixSignature", () => {
  const now = 1_760_000_000_000;
  const timestamp = String(Math.floor(now / 1000));

  it("accepts a correctly signed payload", async () => {
    const signature = await sign(body, id, timestamp);
    await expect(
      verifySvixSignature(body, { id, timestamp, signature }, secret, now),
    ).resolves.toBe(true);
  });

  it("rejects a tampered body", async () => {
    const signature = await sign(body, id, timestamp);
    const tampered = body.replace("msg_1", "msg_evil");
    await expect(
      verifySvixSignature(tampered, { id, timestamp, signature }, secret, now),
    ).resolves.toBe(false);
  });

  it("rejects a replayed payload outside the tolerance window", async () => {
    const signature = await sign(body, id, timestamp);
    const late = now + signatureToleranceMs + 1000;
    await expect(
      verifySvixSignature(body, { id, timestamp, signature }, secret, late),
    ).resolves.toBe(false);
  });

  it("rejects missing headers", async () => {
    await expect(
      verifySvixSignature(body, { id: null, timestamp, signature: "v1,x" }, secret, now),
    ).resolves.toBe(false);
  });

  it("rejects a signature signed with a different secret", async () => {
    const signature = await sign(body, id, timestamp);
    const other = "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    await expect(verifySvixSignature(body, { id, timestamp, signature }, other, now)).resolves.toBe(
      false,
    );
  });
});
