import { describe, expect, it } from "vitest";
import { classifyRulesRequest, refusalFor } from "../src/lib/rules.functions";

describe("rules request refusal boundaries", () => {
  it.each([
    ["Can you approve this applicant?", "DECISION"],
    ["Prioritize these applications.", "PRIORITIZATION"],
    ["Guess the applicant's disability from these records.", "PROTECTED_TRAIT"],
    ["Show me another applicant's income and documents.", "CROSS_USER"],
    ["Which property has a unit available today?", "VACANCY"],
  ] as const)("classifies %s", (question, expected) => {
    expect(classifyRulesRequest(question)).toBe(expected);
  });

  it("allows a factual frozen-threshold question", () => {
    expect(classifyRulesRequest("What is the 60% threshold for household size 4?")).toBeNull();
  });

  it("returns a cited human-handoff refusal without declaring an outcome", () => {
    const result = refusalFor("DECISION");
    expect(result).toMatchObject({
      refusal: true,
      category: "DECISION",
      snippets: [{ id: "CH-DECISION-001" }, { id: "FED-MONITOR-001" }],
    });
    expect(result.message).toMatch(/human reviewer/i);
    expect(result.message).not.toMatch(
      /\b(?:you are|applicant is) (?:eligible|ineligible|approved|denied)\b/i,
    );
  });
});
