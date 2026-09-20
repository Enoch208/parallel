import { describe, expect, it } from "vitest";
import { readEventId, readEventType, readInboundMessage } from "../../convex/model/webhookPayload";

const message = {
  message_id: "<abc@mail.gmail.com>",
  thread_id: "09ac6123",
  from: "Enoch Idowu <enochid200@gmail.com>",
  subject: "Re: Your Parallel plan [PL-TEST]",
  text: "cant make the 2pm, customer lunch\n\nOn Sun, AgentMail wrote:\n> your plan",
  extracted_text: "cant make the 2pm, customer lunch",
};

describe("readInboundMessage", () => {
  it("finds the message when nested under data", () => {
    const found = readInboundMessage({ type: "message.received", data: message });
    expect(found?.from).toContain("enochid200@gmail.com");
    expect(found?.threadId).toBe("09ac6123");
  });

  it("finds the message when nested under message", () => {
    expect(readInboundMessage({ type: "message.received", message })?.subject).toContain("PL-TEST");
  });

  it("finds the message at the top level", () => {
    expect(readInboundMessage(message)?.subject).toContain("PL-TEST");
  });

  it("finds the message nested two levels deep", () => {
    expect(readInboundMessage({ event: { payload: { message } } })?.threadId).toBe("09ac6123");
  });

  it("prefers extracted_text so the quoted reply chain is excluded", () => {
    const found = readInboundMessage({ data: message });
    expect(found?.body).toBe("cant make the 2pm, customer lunch");
    expect(found?.body).not.toContain("AgentMail wrote");
  });

  it("falls back to text when extracted_text is absent", () => {
    const withoutExtracted: Record<string, unknown> = { ...message };
    delete withoutExtracted.extracted_text;
    expect(readInboundMessage({ data: withoutExtracted })?.body).toContain("On Sun");
  });

  it("returns null when there is no message anywhere", () => {
    expect(readInboundMessage({ type: "domain.verified", data: { domain: "x.com" } })).toBeNull();
  });
});

describe("readEventId and readEventType", () => {
  it("reads an event id from either field", () => {
    expect(readEventId({ event_id: "evt_1" }, "fb")).toBe("evt_1");
    expect(readEventId({ id: "evt_2" }, "fb")).toBe("evt_2");
    expect(readEventId({}, "fb")).toBe("fb");
  });

  it("reads an event type from either field", () => {
    expect(readEventType({ type: "message.received" })).toBe("message.received");
    expect(readEventType({ event_type: "message.received" })).toBe("message.received");
    expect(readEventType({})).toBe("unknown");
  });

  it("prefers the specific event_type over a generic type", () => {
    expect(readEventType({ type: "event", event_type: "message.received" })).toBe(
      "message.received",
    );
  });
});
