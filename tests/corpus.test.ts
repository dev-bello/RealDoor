import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHALLENGE_DATE,
  GOLD_CHECKLIST,
  PERIODS_PER_YEAR,
  RULE_CORPUS,
  aggregateIncomeSources,
  annualize,
  assessReadiness,
  checklistStatusFor,
  compareToThreshold,
  findRuleSnippets,
  incomeLimitFor,
  ruleById,
  type EvidenceRecord,
  type IncomeSource,
  type OrganizerDocumentType,
  type PayPeriod,
} from "../src/lib/corpus";
import { organizerScenarios, source, sourceBox } from "./fixtures/organizer-scenarios";

describe("frozen household thresholds", () => {
  const thresholds = [72_000, 82_320, 92_580, 102_840, 111_120, 119_340, 127_560, 135_780];

  it.each(thresholds.map((threshold, index) => [index + 1, threshold]))(
    "returns the exact size %i threshold",
    (size, threshold) => {
      expect(incomeLimitFor(size)).toBe(threshold);
      expect(compareToThreshold(threshold, size)).toEqual({
        comparison: "below_or_equal",
        threshold,
      });
      expect(compareToThreshold(threshold + 0.01, size)).toEqual({
        comparison: "above",
        threshold,
      });
    },
  );

  it.each([0, 9, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not round or clamp unsupported size %s",
    (size) => {
      expect(incomeLimitFor(size)).toBeNull();
      expect(compareToThreshold(1, size)).toEqual({
        comparison: "no_frozen_threshold",
        threshold: null,
      });
    },
  );

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid annual income %s",
    (income) => {
      expect(() => compareToThreshold(income, 1)).toThrow(RangeError);
    },
  );
});

describe("annualization", () => {
  it.each(Object.entries(PERIODS_PER_YEAR) as [PayPeriod, number][])(
    "uses the %s factor",
    (period, factor) => {
      expect(annualize(100, period)).toBe(100 * factor);
    },
  );

  it("rounds gross pay to cents before multiplication", () => {
    expect(annualize(10.005, "monthly")).toBe(120.12);
    expect(annualize(0.1, "weekly")).toBe(5.2);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid gross pay %s", (gross) => {
    expect(() => annualize(gross, "annual")).toThrow(RangeError);
  });

  it("rejects an unsupported period at runtime", () => {
    expect(() => annualize(100, "daily" as PayPeriod)).toThrow("Unsupported pay period");
  });
});

describe("income source aggregation", () => {
  it.each(organizerScenarios)(
    "matches organizer total and threshold for $id",
    ({ householdSize, expectedTotal, expectedThreshold, sources }) => {
      const aggregation = aggregateIncomeSources(sources);
      expect(aggregation.annualTotal).toBe(expectedTotal);
      expect(aggregation.excluded).toEqual([]);
      expect(compareToThreshold(aggregation.annualTotal, householdSize)).toEqual({
        comparison: "below_or_equal",
        threshold: expectedThreshold,
      });
    },
  );

  it("sums documented wages, benefits, and gig income through integer cents", () => {
    const sources = [
      source("wages", 1_000, "biweekly", "pay_stub"),
      source("benefits", 500, "monthly", "benefit_letter"),
      source("gig", 250, "monthly", "gig_income_corroboration"),
    ];

    expect(aggregateIncomeSources(sources)).toMatchObject({
      annualTotal: 35_000,
      included: [
        { id: "wages", annualAmount: 26_000 },
        { id: "benefits", annualAmount: 6_000 },
        { id: "gig", annualAmount: 3_000 },
      ],
      excluded: [],
    });
  });

  it("excludes non-recurring, undocumented, and untraceable sources in that order", () => {
    const sources: IncomeSource[] = [
      { ...source("one-time", 100, "annual", "pay_stub"), recurring: false },
      {
        ...source("self-claim", 100, "annual", "application_summary"),
        independentlyDocumented: false,
      },
      { ...source("no-box", 100, "annual", "pay_stub"), sourceBox: null },
      {
        ...source("reversed-box", 100, "annual", "pay_stub"),
        sourceBox: { page: 1, bbox: [20, 20, 10, 30] },
      },
    ];

    const result = aggregateIncomeSources(sources);
    expect(result.annualTotal).toBe(0);
    expect(result.included).toEqual([]);
    expect(result.excluded.map(({ source: excluded, reason }) => [excluded.id, reason])).toEqual([
      ["one-time", "NOT_RECURRING"],
      ["self-claim", "NOT_INDEPENDENTLY_DOCUMENTED"],
      ["no-box", "UNTRACEABLE"],
      ["reversed-box", "UNTRACEABLE"],
    ]);
  });
});

describe("readiness", () => {
  const required: OrganizerDocumentType[] = ["application_summary", "pay_stub"];
  const evidence = (
    id: string,
    documentType: OrganizerDocumentType,
    overrides: Partial<EvidenceRecord> = {},
  ): EvidenceRecord => ({
    id,
    documentType,
    documentDate: "2026-07-01",
    sourceBoxes: [sourceBox],
    ...overrides,
  });

  afterEach(() => vi.useRealTimers());

  it("reports missing required evidence", () => {
    expect(assessReadiness(required, [evidence("app", "application_summary")])).toMatchObject({
      status: "NEEDS_REVIEW",
      reasons: [{ code: "MISSING", documentType: "pay_stub" }],
    });
  });

  it("accepts exactly 60 days and expires at 61 days", () => {
    expect(
      assessReadiness(
        ["employment_letter"],
        [evidence("current", "employment_letter", { documentDate: "2026-05-19" })],
      ).status,
    ).toBe("READY_TO_REVIEW");
    expect(
      assessReadiness(
        ["employment_letter"],
        [evidence("old", "employment_letter", { documentDate: "2026-05-18" })],
      ).reasons,
    ).toEqual([{ code: "EXPIRED", documentType: "employment_letter", evidenceId: "old" }]);
  });

  it("reports explicit and future-date conflicts without duplicate reasons", () => {
    expect(
      assessReadiness(
        ["pay_stub"],
        [evidence("future", "pay_stub", { conflict: true, documentDate: "2026-07-19" })],
      ).reasons,
    ).toEqual([{ code: "CONFLICT", documentType: "pay_stub", evidenceId: "future" }]);
  });

  it.each([
    ["missing date", { documentDate: null }],
    ["invalid date", { documentDate: "2026-02-30" }],
    ["missing boxes", { sourceBoxes: null }],
    ["malformed box", { sourceBoxes: [{ page: 0, bbox: [0, 0, 10, 10] }] }],
  ] as const)("reports untraceable evidence with %s", (_label, overrides) => {
    expect(assessReadiness(["pay_stub"], [evidence("bad", "pay_stub", overrides)]).reasons).toEqual(
      [{ code: "UNTRACEABLE", documentType: "pay_stub", evidenceId: "bad" }],
    );
  });

  it("uses the frozen challenge date rather than the system clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
    const result = assessReadiness(
      ["pay_stub"],
      [evidence("stub", "pay_stub", { documentDate: "2026-05-19" })],
    );
    expect(result).toMatchObject({ status: "READY_TO_REVIEW", asOfDate: CHALLENGE_DATE });
  });

  it("applies frozen-date status to confirmed extraction rows", () => {
    const payStub = GOLD_CHECKLIST.find((item) => item.id === "pay_stub");
    expect(payStub).toBeDefined();
    expect(
      checklistStatusFor(payStub!, [
        {
          doc_type: "pay_stub",
          confirmed_json: { pay_date: "2026-05-18", gross_pay: 1_768 },
        },
      ]),
    ).toEqual({ status: "expired", ageDays: 61, payDate: "2026-05-18" });
  });
});

describe("frozen rule corpus", () => {
  const exactIds = [
    "HUD-MTSP-001",
    "HUD-MTSP-002",
    "HUD-MTSP-003",
    "HUD-DATA-001",
    "HUD-GEO-001",
    "FED-LIHTC-001",
    "FED-MONITOR-001",
    "CH-INCOME-001",
    "CH-READINESS-001",
    "CH-SAFETY-001",
    "CH-DECISION-001",
  ];

  it("contains exactly the 11 organizer IDs in organizer order", () => {
    expect(RULE_CORPUS.map((rule) => rule.rule_id)).toEqual(exactIds);
    expect(new Set(exactIds).size).toBe(11);
  });

  it("retrieves exact IDs and rejects unknown IDs", () => {
    expect(ruleById("CH-READINESS-001")?.id).toBe("CH-READINESS-001");
    expect(findRuleSnippets("Explain CH-DECISION-001", 1)[0]?.id).toBe("CH-DECISION-001");
    expect(ruleById("CH-NOT-REAL")).toBeNull();
  });

  it("states the prohibited decision labels while calculation output avoids them", () => {
    const decisionRule = ruleById("CH-DECISION-001");
    expect(decisionRule?.text).toMatch(/eligible, ineligible, approved, denied, or prioritized/);
    expect(JSON.stringify(compareToThreshold(72_000, 1))).not.toMatch(
      /\b(?:eligible|ineligible|approved|denied|prioritized)\b/i,
    );
  });
});
