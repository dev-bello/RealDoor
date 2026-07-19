import { describe, expect, it } from "vitest";
import { buildProfileSummary, joinConfirmedEvidence } from "../src/lib/profile-data";
import { confirmedProfileRows, rawField, row } from "./fixtures/profile-rows";

describe("confirmed profile extraction rows", () => {
  it("joins confirmed values to raw page-level evidence", () => {
    const extraction = row("app", "application_summary", {
      household_size: 4,
      application_date: "2026-07-10",
    });
    extraction.raw_json = {
      fields: [rawField("household_size", 3, 0), rawField("application_date", "2026-07-10", 1)],
    };

    const document = joinConfirmedEvidence(extraction);
    expect(document).toMatchObject({
      id: "app",
      documentType: "application_summary",
      documentDate: "2026-07-10",
      values: { household_size: 4 },
      missingEvidenceFields: [],
    });
    expect(document?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "household_size",
          value: 4,
          confidence: 0.99,
          sourceBox: expect.objectContaining({
            page: 1,
            bboxUnits: "pdf_points_bottom_left_origin",
          }),
          pageSize: [612, 792],
        }),
      ]),
    );
  });

  it("records confirmed fields that have no raw traceability", () => {
    const extraction = row("app", "application_summary", {
      household_size: 4,
      address: "14 Main St",
    });
    extraction.raw_json = { fields: [rawField("household_size", 4, 0)] };
    expect(joinConfirmedEvidence(extraction)).toMatchObject({
      values: { household_size: 4, address: "14 Main St" },
      missingEvidenceFields: ["address"],
    });
  });

  it.each([
    row("unconfirmed", "pay_stub", { gross_pay: 100 }),
    row("unknown", "tax_return", { gross_pay: 100 }),
    { ...row("empty", "pay_stub", { gross_pay: 100 }), confirmed_json: {} },
  ])("ignores unusable row $id", (extraction) => {
    if (extraction.id === "unconfirmed") extraction.confirmed_at = null;
    expect(joinConfirmedEvidence(extraction)).toBeNull();
  });
});

describe("profile scenarios", () => {
  it("builds a ready multi-source wages, benefits, and gig profile", () => {
    const summary = buildProfileSummary(confirmedProfileRows);
    expect(summary).toMatchObject({
      hasConfirmedData: true,
      householdSize: 4,
      annualIncome: 35_000,
      threshold: 102_840,
      comparison: "below_or_equal",
      requiredDocumentTypes: [
        "application_summary",
        "pay_stub",
        "employment_letter",
        "benefit_letter",
        "gig_income_corroboration",
      ],
      readiness: { status: "READY_TO_REVIEW", reasons: [], asOfDate: "2026-07-18" },
      missingConfirmedInputs: [],
    });
    expect(
      summary.incomeSources.map(({ kind, amount, period }) => ({ kind, amount, period })),
    ).toEqual([
      { kind: "wages", amount: 1_000, period: "biweekly" },
      { kind: "benefit", amount: 500, period: "monthly" },
      { kind: "gig", amount: 250, period: "monthly" },
    ]);
    expect(summary.checklist.every((item) => item.status === "provided")).toBe(true);
  });

  it("surfaces pay-component conflicts instead of declaring readiness", () => {
    const rows = confirmedProfileRows.map((extraction) =>
      extraction.id === "stub-1"
        ? row("stub-1", "pay_stub", {
            person_name: "Test Resident",
            pay_date: "2026-07-01",
            pay_frequency: "biweekly",
            regular_hours: 40,
            hourly_rate: 25,
            gross_pay: 1_400,
          })
        : extraction,
    );
    const summary = buildProfileSummary(rows);
    expect(summary.annualIncome).toBe(61_000);
    expect(summary.readiness.status).toBe("NEEDS_REVIEW");
    expect(summary.readiness.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CONFLICT", evidenceId: "stub-1" }),
        expect.objectContaining({ code: "INCOME_CONFLICT", sourceId: "wages:test resident" }),
      ]),
    );
  });

  it("refuses a frozen comparison for unsupported household size 9", () => {
    const rows = confirmedProfileRows.map((extraction) =>
      extraction.id === "app-1"
        ? row("app-1", "application_summary", {
            person_name: "Test Resident",
            household_size: 9,
            application_date: "2026-07-10",
          })
        : extraction,
    );
    const summary = buildProfileSummary(rows);
    expect(summary).toMatchObject({ threshold: null, comparison: "not_calculated" });
    expect(summary.readiness.reasons).toContainEqual({
      code: "UNSUPPORTED_HOUSEHOLD_SIZE",
      message: expect.stringContaining("no frozen threshold"),
    });
  });
});
