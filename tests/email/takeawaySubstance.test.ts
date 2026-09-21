import { describe, expect, it } from "vitest";
import { saysMoreThanTheTitle } from "../../convex/model/takeawaySubstance";

const title = "Community Health Centers 101: Purpose Meets Innovation and Partnership Workshop";

describe("a takeaway has to say something about the session", () => {
  it("refuses a reply that only names the session", () => {
    expect(saysMoreThanTheTitle("Takeaway from Community Health Centers 101", title)).toBe(false);
  });

  it("refuses a reply that names the session with a trailing ellipsis", () => {
    expect(saysMoreThanTheTitle("Takeaway from Community Health Centers 101: …", title)).toBe(
      false,
    );
  });

  it("refuses a one-word verdict", () => {
    expect(saysMoreThanTheTitle("Community Health Centers 101: great session", title)).toBe(false);
  });

  it("accepts a sentence of what was learned", () => {
    expect(
      saysMoreThanTheTitle(
        "Takeaway from Community Health Centers 101: health centers want partners who fit their referral workflow.",
        title,
      ),
    ).toBe(true);
  });

  it("accepts a takeaway that never repeats the title", () => {
    expect(
      saysMoreThanTheTitle("Their rollout took eighteen months and two failed pilots.", title),
    ).toBe(true);
  });
});
