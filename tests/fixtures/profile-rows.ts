import type { ProfileExtractionRow } from "../../src/lib/profile-data";

type ConfirmedValue = string | number;

function rawField(field: string, value: ConfirmedValue, index: number) {
  return {
    field,
    value,
    confidence: 0.99,
    page: 1,
    bbox: [40, 700 - index * 30, 240, 718 - index * 30],
    page_size: [612, 792],
    bbox_units: "pdf_points_bottom_left_origin",
  };
}

function row(
  id: string,
  doc_type: string,
  confirmed_json: Record<string, ConfirmedValue>,
): ProfileExtractionRow {
  return {
    id,
    doc_type,
    confirmed_json,
    raw_json: {
      household_id: "HH-TEST",
      fields: Object.entries(confirmed_json).map(([field, value], index) =>
        rawField(field, value, index),
      ),
    },
    confirmed_at: "2026-07-12T12:00:00Z",
    created_at: "2026-07-11T12:00:00Z",
  };
}

export const confirmedProfileRows: ProfileExtractionRow[] = [
  row("app-1", "application_summary", {
    person_name: "Test Resident",
    household_size: 4,
    application_date: "2026-07-10",
  }),
  row("stub-1", "pay_stub", {
    person_name: "Test Resident",
    pay_date: "2026-07-01",
    pay_frequency: "biweekly",
    regular_hours: 40,
    hourly_rate: 25,
    gross_pay: 1_000,
  }),
  row("employment-1", "employment_letter", {
    person_name: "Test Resident",
    document_date: "2026-07-02",
    weekly_hours: 40,
    hourly_rate: 25,
  }),
  row("benefit-1", "benefit_letter", {
    person_name: "Test Resident",
    document_date: "2026-07-03",
    monthly_benefit: 500,
    benefit_frequency: "monthly",
  }),
  row("gig-1", "gig_income_corroboration", {
    person_name: "Test Resident",
    document_date: "2026-07-04",
    gross_receipts: 250,
    platform_fees: 25,
  }),
];

export { rawField, row };
