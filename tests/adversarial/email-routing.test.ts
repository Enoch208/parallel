import { describe, expect, it } from "vitest";
import { makeToken, normalizeAddress, tokenFromSubject } from "../../convex/model/threadRouting";
import { subjectWithToken } from "../../convex/model/agentmailClient";
import { parseReply, shouldApplyAutomatically } from "../../convex/model/replySchema";

function routesToMember(subject: string, memberEmail: string, fromAddress: string): boolean {
  const token = tokenFromSubject(subject);

  if (token === null) {
    return false;
  }

  return normalizeAddress(memberEmail) === normalizeAddress(fromAddress);
}

const adaToken = makeToken(9_123_456);
const adaSubject = subjectWithToken("Your Parallel plan", adaToken);

describe("hostile subject tokens", () => {
  it("refuses another teammate's token sent from a different address", () => {
    expect(tokenFromSubject(adaSubject)).toBe(adaToken);
    expect(routesToMember(adaSubject, "ada@team.test", "mallory@evil.test")).toBe(false);
  });

  it("routes the same teammate through every casing and angle bracket form of their address", () => {
    const forms = [
      "ada@team.test",
      "ADA@TEAM.TEST",
      "  Ada@Team.Test  ",
      "<ada@team.test>",
      "Ada Lovelace <ADA@team.test>",
      '"Lovelace, Ada" <ada@TEAM.test>',
    ];

    for (const from of forms) {
      expect(routesToMember(adaSubject, "ada@team.test", from)).toBe(true);
    }
  });

  it("does not route a From header carrying two addresses", () => {
    expect(normalizeAddress("ada@team.test, mallory@evil.test")).toBe(
      "ada@team.test, mallory@evil.test",
    );
    expect(routesToMember(adaSubject, "ada@team.test", "ada@team.test, mallory@evil.test")).toBe(
      false,
    );
  });

  it("reads no token from a marker of the wrong length", () => {
    expect(tokenFromSubject("Re: your plan [PL-AB2]")).toBeNull();
    expect(tokenFromSubject("Re: your plan [PL-ABCDEFGHI]")).toBeNull();
    expect(tokenFromSubject("Re: your plan [PL-]")).toBeNull();
    expect(tokenFromSubject("Re: your plan [PL-ab2c")).toBeNull();
    expect(tokenFromSubject("Re: your plan PL-AB2C")).toBeNull();
    expect(tokenFromSubject("Re: your plan")).toBeNull();
  });

  it("accepts a lowercased token, because mail clients rewrite subjects", () => {
    expect(tokenFromSubject("re: your parallel plan [pl-ab2c]")).toBe("AB2C");
  });

  it("returns the whole subject instead of a token when the subject contains a newline", () => {
    const folded = `${adaSubject}\nSent from my phone`;

    expect(tokenFromSubject(folded)).toBe(folded.toUpperCase());
    expect(tokenFromSubject(folded)).not.toBe(adaToken);
  });

  it("takes the last token when a forwarded subject carries two, not the one the matcher found", () => {
    expect(tokenFromSubject("Re: [PL-AB2C] fwd [PL-XY9Z]")).toBe("XY9Z");
  });

  it("mints tokens only from the unambiguous alphabet and never repeats one across the seeds a deployment uses", () => {
    const seeds = Array.from({ length: 4096 }, (_unused, index) => 7 + index * 101);
    const tokens = seeds.map(makeToken);

    for (const token of tokens) {
      expect(token).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    }

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("collapses the sign of a seed and the tail of a small seed, so a token is not a secret", () => {
    expect(makeToken(-5)).toBe(makeToken(5));
    expect(new Set([0, 1, 2, 3, 4].map((seed) => makeToken(seed).slice(1))).size).toBe(1);
  });
});

const body = [
  "Thanks for the plan.",
  "I cannot make the 14:00 platform session, I have a customer call.",
  "Everything else looks right.",
].join("\n");

function parsed(quote: string | null, confidence: number): boolean {
  return shouldApplyAutomatically(parseReply({ intent: "cant_attend", confidence, quote }, body));
}

describe("the verbatim quote guard", () => {
  it("applies a quote that differs only in whitespace or casing", () => {
    expect(parsed("i cannot   make the 14:00 PLATFORM session", 0.9)).toBe(true);
    expect(parsed("\n  I cannot make the 14:00 platform session  \n", 0.9)).toBe(true);
  });

  it("refuses a near-miss paraphrase", () => {
    expect(parsed("I can't make the 14:00 platform session", 0.99)).toBe(false);
    expect(parsed("I cannot attend the 14:00 platform session", 0.99)).toBe(false);
    expect(parsed("I cannot make the 14.00 platform session", 0.99)).toBe(false);
    expect(parsed("I cannot make the 2pm platform session", 0.99)).toBe(false);
  });

  it("refuses a missing quote however confident the model claims to be", () => {
    expect(parsed(null, 1)).toBe(false);
    expect(parsed("", 1)).toBe(false);
  });

  it("applies at exactly the threshold and refuses just below it", () => {
    const sentence = "I cannot make the 14:00 platform session, I have a customer call.";

    expect(parsed(sentence, 0.75)).toBe(true);
    expect(parsed(sentence, 0.7499999999)).toBe(false);
  });

  it("refuses a confidence that is not a number, out of range or not finite", () => {
    const sentence = "I cannot make the 14:00 platform session, I have a customer call.";

    expect(
      parseReply({ intent: "cant_attend", confidence: "0.99", quote: sentence }, body).confidence,
    ).toBe(0);
    expect(
      parseReply({ intent: "cant_attend", confidence: 4, quote: sentence }, body).confidence,
    ).toBe(1);
    expect(
      parseReply({ intent: "cant_attend", confidence: -2, quote: sentence }, body).confidence,
    ).toBe(0);
    expect(parsed(Number.NaN as unknown as string, 0.9)).toBe(false);
    expect(
      shouldApplyAutomatically(
        parseReply({ intent: "cant_attend", confidence: Number.NaN, quote: sentence }, body),
      ),
    ).toBe(false);
  });

  it("falls back to other for an unknown intent and throws on a non object", () => {
    expect(
      parseReply({ intent: "delete_everything", confidence: 1, quote: null }, body).intent,
    ).toBe("other");
    expect(() => parseReply(null, body)).toThrow();
    expect(() => parseReply("yes", body)).toThrow();
  });

  it("accepts a one character quote as verbatim evidence, so the guard is a substring check and not a sentence check", () => {
    expect(parsed("I", 1)).toBe(true);
    expect(parsed("a", 1)).toBe(true);
    expect(parsed(".", 1)).toBe(true);
  });
});
