import { describe, expect, it } from "vitest";
import { decideDeadlineFollowUp } from "../src/deadline_policy.js";

describe("deadline follow-up policy", () => {
  it("contacts the legal team now when only two days remain", () => {
    const decision = decideDeadlineFollowUp(
      "2030-06-12",
      new Date("2030-06-10T09:00:00.000Z")
    );

    expect(decision).toEqual({
      action: "contact-now",
      followUpAt: "2030-06-10T09:00:00.000Z",
      daysRemaining: 2
    });
  });
});
