import type { IncomeSource } from "../../src/lib/corpus";

const sourceBox = {
  page: 1,
  bbox: [40, 498, 397.38, 544] as const,
  bboxUnits: "pdf_points_bottom_left_origin",
};

function source(
  id: string,
  amount: number,
  period: IncomeSource["period"],
  documentType: IncomeSource["documentType"],
): IncomeSource {
  return {
    id,
    amount,
    period,
    documentType,
    recurring: true,
    independentlyDocumented: true,
    sourceBox,
  };
}

export const organizerScenarios = [
  {
    id: "HH-001",
    householdSize: 1,
    expectedTotal: 56_316,
    expectedThreshold: 72_000,
    sources: [source("HH-001-D02", 2_166, "biweekly", "pay_stub")],
  },
  {
    id: "HH-002",
    householdSize: 2,
    expectedTotal: 49_920,
    expectedThreshold: 82_320,
    sources: [source("HH-002-D04", 960, "weekly", "employment_letter")],
  },
  {
    id: "HH-003",
    householdSize: 3,
    expectedTotal: 40_230,
    expectedThreshold: 92_580,
    sources: [
      source("HH-003-D02", 1_155, "biweekly", "pay_stub"),
      source("HH-003-D04", 850, "monthly", "benefit_letter"),
    ],
  },
  {
    id: "HH-004",
    householdSize: 4,
    expectedTotal: 51_008,
    expectedThreshold: 102_840,
    sources: [
      source("HH-004-D02", 1_408, "biweekly", "pay_stub"),
      source("HH-004-D04", 1_200, "monthly", "gig_statement"),
    ],
  },
  {
    id: "HH-005",
    householdSize: 5,
    expectedTotal: 45_968,
    expectedThreshold: 111_120,
    sources: [source("HH-005-D02", 1_768, "biweekly", "pay_stub")],
  },
  {
    id: "HH-006",
    householdSize: 6,
    expectedTotal: 105_000,
    expectedThreshold: 119_340,
    sources: [
      source("HH-006-D02", 3_600, "biweekly", "pay_stub"),
      source("HH-006-D04", 950, "monthly", "benefit_letter"),
    ],
  },
] as const;

export { source, sourceBox };
