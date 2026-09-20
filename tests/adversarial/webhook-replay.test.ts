import { describe, expect, it } from "vitest";
import { signatureToleranceMs, verifySvixSignature } from "../../convex/model/svix";
import { readEventId, readEventType, readInboundMessage } from "../../convex/model/webhookPayload";
import { readMonitoredUrl } from "../../convex/model/monitorPayload";

const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const now = 1_760_000_000_000;
const timestamp = String(Math.floor(now / 1000));
const id = "msg_2f3b";
const body = JSON.stringify({
  event_type: "message.received",
  event_id: "evt_9",
  message: { message_id: "m_1", thread_id: "t_1", from: "ada@team.test", subject: "Re: plan" },
});

async function sign(payload: string, messageId: string, sentAt: string): Promise<string> {
  const raw = atob(secret.slice("whsec_".length));
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
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
    new TextEncoder().encode(`${messageId}.${sentAt}.${payload}`),
  );

  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);

  return `v1,${btoa(binary)}`;
}

describe("replayed webhooks", () => {
  it("accepts the identical delivery twice, so dedupe is the database's job and never the signature's", async () => {
    const signature = await sign(body, id, timestamp);
    const headers = { id, timestamp, signature };

    await expect(verifySvixSignature(body, headers, secret, now)).resolves.toBe(true);
    await expect(verifySvixSignature(body, headers, secret, now + 1000)).resolves.toBe(true);
  });

  it("rejects a delivery replayed after the tolerance window on either side", async () => {
    const signature = await sign(body, id, timestamp);
    const headers = { id, timestamp, signature };

    await expect(
      verifySvixSignature(body, headers, secret, now + signatureToleranceMs + 1),
    ).resolves.toBe(false);
    await expect(
      verifySvixSignature(body, headers, secret, now - signatureToleranceMs - 1),
    ).resolves.toBe(false);
  });

  it("rejects a signature that is valid for a different body", async () => {
    const signature = await sign(body, id, timestamp);
    const swapped = body.replace("ada@team.test", "attacker@evil.test");

    await expect(
      verifySvixSignature(swapped, { id, timestamp, signature }, secret, now),
    ).resolves.toBe(false);
  });

  it("rejects a signature that is valid for a different message id", async () => {
    const signature = await sign(body, "msg_other", timestamp);

    await expect(
      verifySvixSignature(body, { id, timestamp, signature }, secret, now),
    ).resolves.toBe(false);
  });

  it("rejects a signature lifted from a different timestamp", async () => {
    const earlier = String(Math.floor(now / 1000) - 60);
    const signature = await sign(body, id, earlier);

    await expect(
      verifySvixSignature(body, { id, timestamp, signature }, secret, now),
    ).resolves.toBe(false);
  });

  it("rejects every malformed header shape without trusting the body", async () => {
    const signature = await sign(body, id, timestamp);
    const cases = [
      { id: null, timestamp, signature },
      { id, timestamp: null, signature },
      { id, timestamp, signature: null },
      { id, timestamp: "abc", signature },
      { id, timestamp: "", signature },
      { id, timestamp: " " + timestamp + " ", signature },
      { id, timestamp, signature: "" },
      { id, timestamp, signature: "v1," },
      { id, timestamp, signature: signature.slice("v1,".length) },
      { id, timestamp, signature: signature.replace("v1,", "v2,") },
    ];

    for (const headers of cases) {
      await expect(verifySvixSignature(body, headers, secret, now)).resolves.toBe(false);
    }
  });

  it("accepts a real signature offered beside a decoy in the same header", async () => {
    const signature = await sign(body, id, timestamp);

    await expect(
      verifySvixSignature(
        body,
        { id, timestamp, signature: `v1,ZGVjb3k= ${signature}` },
        secret,
        now,
      ),
    ).resolves.toBe(true);
  });

  it("throws rather than rejecting when the configured secret is not base64, which surfaces as a 500 and an endless provider retry", async () => {
    const signature = await sign(body, id, timestamp);

    await expect(
      verifySvixSignature(body, { id, timestamp, signature }, "whsec_not base64!!", now),
    ).rejects.toThrow();
  });
});

describe("event identity under replay", () => {
  it("prefers event_id, then id, then the caller's fallback", () => {
    expect(readEventId({ event_id: "evt_1", id: "other" }, "fb")).toBe("evt_1");
    expect(readEventId({ id: "evt_2" }, "fb")).toBe("evt_2");
    expect(readEventId({}, "fb")).toBe("fb");
    expect(readEventId(null, "fb")).toBe("fb");
    expect(readEventId("not-an-object", "fb")).toBe("fb");
  });

  it("does not look for event_id below the top level even though the message search goes four deep", () => {
    expect(readEventId({ data: { event_id: "evt_nested" } }, "fb")).toBe("fb");
    expect(readInboundMessage({ a: { b: { c: { subject: "s", from: "f" } } } })).not.toBeNull();
  });

  it("gives two different messages the same identity when the payload carries no id and the first 64 bytes agree", () => {
    const prefix = '{"type":"message.received","data":{"message":{"subject":"Re: ';
    const first = `${prefix}plan","from":"ada@team.test"}}}`;
    const second = `${prefix}plan","from":"bob@team.test"}}}`;

    expect(prefix.length).toBeGreaterThan(60);
    expect(readEventId(JSON.parse(first), first.slice(0, 64))).toBe(
      readEventId(JSON.parse(second), second.slice(0, 64)),
    );
  });

  it("falls back to unknown rather than guessing an event type", () => {
    expect(readEventType({ type: "message.received" })).toBe("message.received");
    expect(readEventType({ event_type: "", type: "message.received" })).toBe("message.received");
    expect(readEventType({})).toBe("unknown");
    expect(readEventType([])).toBe("unknown");
  });

  it("reads a message with no ids at all without inventing a sender", () => {
    const message = readInboundMessage({ data: { subject: "Re: plan", from: "" } });

    expect(message).toEqual({
      messageId: null,
      threadId: null,
      from: "unknown",
      subject: "Re: plan",
      body: "",
    });
  });
});

describe("monitor payloads", () => {
  it("takes a named url over an attacker-supplied one deeper in the payload", () => {
    expect(
      readMonitoredUrl({ metadata: { note: "https://evil.test" }, url: "https://real.test" }),
    ).toBe("https://real.test");
  });

  it("never returns a non https url", () => {
    expect(readMonitoredUrl({ url: "http://real.test" })).toBeNull();
    expect(readMonitoredUrl({ url: "javascript:https://x" })).toBeNull();
    expect(readMonitoredUrl({})).toBeNull();
  });

  it("stops looking below four levels, so a deeply nested url is reported as no url", () => {
    expect(readMonitoredUrl({ a: { b: { c: { d: { e: "https://deep.test" } } } } })).toBeNull();
  });
});
