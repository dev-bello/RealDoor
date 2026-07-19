import {
  GOLD_CHECKLIST,
  aggregateIncomeSources,
  assessReadiness,
  compareToThreshold,
  type EvidenceRecord,
  type IncomeAggregation,
  type OrganizerDocumentType,
  type PayPeriod,
  type ReadinessAssessment,
  type SourceBox,
  type ThresholdComparison,
} from "./corpus";

const DOCUMENT_TYPES = new Set<OrganizerDocumentType>([
  "application_summary",
  "pay_stub",
  "employment_letter",
  "benefit_letter",
  "gig_statement",
  "gig_income_corroboration",
]);
const PAY_PERIODS = new Set<PayPeriod>(["weekly", "biweekly", "semimonthly", "monthly", "annual"]);

export interface ProfileExtractionRow {
  id: string;
  doc_type: string;
  raw_json: unknown;
  confirmed_json: unknown;
  confirmed_at?: string | null;
  created_at?: string | null;
}

export interface ConfirmedFieldEvidence {
  field: string;
  value: string | number;
  confidence: number | null;
  sourceBox: SourceBox;
  pageSize: readonly [number, number] | null;
}

export interface ConfirmedDocumentEvidence {
  id: string;
  householdId: string | null;
  documentType: OrganizerDocumentType;
  confirmedAt: string | null;
  documentDate: string | null;
  fields: readonly ConfirmedFieldEvidence[];
  values: Readonly<Record<string, string | number>>;
  missingEvidenceFields: readonly string[];
}

export interface ProfileIncomeSource {
  id: string;
  kind: "wages" | "benefit" | "gig";
  personName: string | null;
  amount: number;
  period: PayPeriod;
  formula: string;
  documentId: string;
  documentType: OrganizerDocumentType;
  evidence: readonly ConfirmedFieldEvidence[];
  displayedGross: number | null;
  conflict: string | null;
}

export type ProfileReadinessReason =
  | {
      code: "MISSING" | "EXPIRED" | "CONFLICT" | "UNTRACEABLE";
      documentType: OrganizerDocumentType;
      evidenceId?: string;
    }
  | { code: "INCOME_CONFLICT"; sourceId: string; message: string }
  | { code: "EXCLUDED_INCOME"; sourceId: string; message: string }
  | { code: "UNSUPPORTED_HOUSEHOLD_SIZE"; message: string }
  | { code: "MISSING_CONFIRMED_INPUT"; message: string };

export interface ProfileChecklistItem {
  id: OrganizerDocumentType;
  label: string;
  required: boolean;
  status: "provided" | "missing" | "expired" | "conflict" | "untraceable";
  evidenceIds: readonly string[];
  reasons: readonly string[];
}

export interface ProfileSummary {
  hasConfirmedData: boolean;
  householdId: string | null;
  documents: readonly ConfirmedDocumentEvidence[];
  householdSize: number | null;
  householdEvidence: ConfirmedFieldEvidence | null;
  householdDocumentId: string | null;
  requiredDocumentTypes: readonly OrganizerDocumentType[];
  incomeSources: readonly ProfileIncomeSource[];
  aggregation: IncomeAggregation;
  annualIncome: number | null;
  threshold: number | null;
  comparison: ThresholdComparison | "not_calculated";
  readiness: Omit<ReadinessAssessment, "reasons"> & {
    reasons: readonly ProfileReadinessReason[];
  };
  checklist: readonly ProfileChecklistItem[];
  missingConfirmedInputs: readonly string[];
}

/** Builds a deterministic profile without changing confirmed values or their raw evidence. */
export function buildProfileSummary(rows: readonly ProfileExtractionRow[]): ProfileSummary {
  const documents = rows.map(joinConfirmedEvidence).filter(isPresent);
  const householdIds = [
    ...new Set(documents.map((document) => document.householdId).filter(isPresent)),
  ];
  const application = newest(
    documents.filter((document) => document.documentType === "application_summary"),
  );
  const householdField =
    application?.fields.find((field) => field.field === "household_size") ?? null;
  const householdSize = finiteNumber(householdField?.value);

  const sourceIssues: string[] = [];
  const wageDocuments = newestPerPerson(
    documents.filter((document) => document.documentType === "pay_stub"),
  );
  const benefitDocuments = newestPerPerson(
    documents.filter((document) => document.documentType === "benefit_letter"),
  );
  const gigDocuments = newestPerPerson(
    documents.filter(
      (document) =>
        document.documentType === "gig_statement" ||
        document.documentType === "gig_income_corroboration",
    ),
  );

  const incomeSources = [
    ...wageDocuments.map((document) => wageSource(document, sourceIssues)),
    ...benefitDocuments.map((document) => benefitSource(document, sourceIssues)),
    ...gigDocuments.map((document) => gigSource(document, sourceIssues)),
  ].filter(isPresent);

  const aggregation = aggregateIncomeSources(
    incomeSources.map((source) => ({
      id: source.id,
      amount: source.amount,
      period: source.period,
      recurring: true,
      independentlyDocumented: true,
      documentType: source.documentType,
      sourceBox: source.evidence[0]?.sourceBox ?? null,
    })),
  );
  const hasBenefitSource = benefitDocuments.some((document) =>
    document.fields.some((field) => field.field === "monthly_benefit"),
  );
  const hasGigSource = gigDocuments.some((document) =>
    document.fields.some((field) => field.field === "gross_receipts"),
  );
  const requiredDocumentTypes: OrganizerDocumentType[] = [
    "application_summary",
    "pay_stub",
    "employment_letter",
    ...(hasBenefitSource ? (["benefit_letter"] as const) : []),
    ...(hasGigSource ? (["gig_income_corroboration"] as const) : []),
  ];
  const conflicts = new Map(
    incomeSources
      .filter((source) => source.conflict)
      .map((source) => [source.documentId, source.conflict as string]),
  );
  const evidence: EvidenceRecord[] = documents.map((document) => ({
    id: document.id,
    documentType: document.documentType,
    documentDate: document.documentDate,
    sourceBoxes: document.fields.map((field) => field.sourceBox),
    conflict: conflicts.has(document.id),
  }));
  const corpusReadiness = assessReadiness(requiredDocumentTypes, evidence);

  const missingConfirmedInputs = [...sourceIssues];
  if (householdIds.length === 0)
    missingConfirmedInputs.push("The organizer household ID is unavailable from the uploaded filename.");
  if (householdIds.length > 1)
    missingConfirmedInputs.push("Confirmed documents reference more than one organizer household ID.");
  for (const document of documents) {
    if (document.missingEvidenceFields.length > 0) {
      missingConfirmedInputs.push(
        `${document.documentType} ${document.id} has confirmed fields without immutable raw evidence: ${document.missingEvidenceFields.join(", ")}.`,
      );
    }
  }
  if (!application) missingConfirmedInputs.push("A confirmed application summary is required.");
  else if (householdSize === null)
    missingConfirmedInputs.push(
      "The confirmed application summary has no traceable household size.",
    );
  if (incomeSources.length === 0)
    missingConfirmedInputs.push("No complete confirmed recurring income source can be calculated.");

  const extraReasons: ProfileReadinessReason[] = [
    ...incomeSources
      .filter((source) => source.conflict)
      .map((source) => ({
        code: "INCOME_CONFLICT" as const,
        sourceId: source.id,
        message: source.conflict as string,
      })),
    ...aggregation.excluded.map(({ source, reason }) => ({
      code: "EXCLUDED_INCOME" as const,
      sourceId: source.id,
      message: `Income source ${source.id} was excluded: ${reason}.`,
    })),
    ...(householdSize !== null && (householdSize < 1 || householdSize > 8)
      ? [
          {
            code: "UNSUPPORTED_HOUSEHOLD_SIZE" as const,
            message: `Household size ${householdSize} has no frozen threshold; supported sizes are 1 through 8.`,
          },
        ]
      : []),
    ...missingConfirmedInputs.map((message) => ({
      code: "MISSING_CONFIRMED_INPUT" as const,
      message,
    })),
  ];
  const reasons: ProfileReadinessReason[] = [...corpusReadiness.reasons, ...extraReasons];
  const canCompare = householdSize !== null && householdSize >= 1 && householdSize <= 8;
  const comparison = canCompare
    ? compareToThreshold(aggregation.annualTotal, householdSize)
    : { comparison: "not_calculated" as const, threshold: null };

  return {
    hasConfirmedData: documents.length > 0,
    householdId: householdIds.length === 1 ? householdIds[0] : null,
    documents,
    householdSize,
    householdEvidence: householdField,
    householdDocumentId: application?.id ?? null,
    requiredDocumentTypes,
    incomeSources,
    aggregation,
    annualIncome: incomeSources.length > 0 ? aggregation.annualTotal : null,
    threshold: comparison.threshold,
    comparison: comparison.comparison,
    readiness: {
      ...corpusReadiness,
      status: reasons.length === 0 ? "READY_TO_REVIEW" : "NEEDS_REVIEW",
      reasons,
    },
    checklist: buildChecklist(requiredDocumentTypes, evidence, corpusReadiness),
    missingConfirmedInputs,
  };
}

export function joinConfirmedEvidence(row: ProfileExtractionRow): ConfirmedDocumentEvidence | null {
  if (!row.confirmed_at || !DOCUMENT_TYPES.has(row.doc_type as OrganizerDocumentType)) return null;
  const confirmed = asRecord(row.confirmed_json);
  if (Object.keys(confirmed).length === 0) return null;
  const rawRecord = asRecord(row.raw_json);
  const rawFields = Array.isArray(rawRecord.fields) ? (rawRecord.fields as unknown[]) : [];
  const rawByName = new Map<string, Record<string, unknown>>();
  for (const raw of rawFields) {
    const field = asRecord(raw);
    if (typeof field.field === "string") rawByName.set(field.field, field);
  }

  const fields: ConfirmedFieldEvidence[] = [];
  const missingEvidenceFields: string[] = [];
  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(confirmed)) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    values[name] = value;
    const raw = rawByName.get(name);
    const sourceBox = raw ? parseSourceBox(raw) : null;
    if (!raw || !sourceBox) {
      missingEvidenceFields.push(name);
      continue;
    }
    fields.push({
      field: name,
      value,
      confidence: finiteNumber(raw.confidence),
      sourceBox,
      pageSize: parsePageSize(raw.page_size),
    });
  }
  return {
    id: row.id,
    householdId: text(rawRecord.household_id),
    documentType: row.doc_type as OrganizerDocumentType,
    confirmedAt: row.confirmed_at,
    documentDate: evidenceDate(values),
    fields,
    values,
    missingEvidenceFields,
  };
}

function wageSource(
  document: ConfirmedDocumentEvidence,
  issues: string[],
): ProfileIncomeSource | null {
  const hours = field(document, "regular_hours");
  const rate = field(document, "hourly_rate");
  const gross = field(document, "gross_pay");
  const frequency = payPeriod(document.values.pay_frequency);
  const personName = text(document.values.person_name);
  if (!frequency) {
    issues.push(`Pay stub ${document.id} has no confirmed supported pay frequency.`);
    return null;
  }

  let amount: number | null = null;
  let formula = "";
  let evidence: ConfirmedFieldEvidence[] = [];
  if (hours && rate) {
    amount = cents(Number(hours.value) * Number(rate.value));
    formula = `${numberText(Number(hours.value))} regular hours x ${money(Number(rate.value))} hourly rate = ${money(amount)} per ${frequency} period`;
    evidence = [hours, rate];
  } else if (gross) {
    amount = finiteNumber(gross.value);
    formula = `${money(amount)} confirmed gross pay per ${frequency} period`;
    evidence = [gross];
  }
  if (amount === null) {
    issues.push(`Pay stub ${document.id} needs gross pay or both regular hours and hourly rate.`);
    return null;
  }
  const displayedGross = finiteNumber(gross?.value);
  const conflict =
    hours && rate && displayedGross !== null && Math.abs(displayedGross - amount) > 0.01
      ? `Displayed gross ${money(displayedGross)} differs from regular-hours components ${money(amount)} by ${money(Math.abs(displayedGross - amount))}.`
      : null;
  return {
    id: `wages:${personKey(document)}`,
    kind: "wages",
    personName,
    amount,
    period: frequency,
    formula,
    documentId: document.id,
    documentType: document.documentType,
    evidence: uniqueFields([
      ...evidence,
      ...(gross ? [gross] : []),
      field(document, "pay_frequency"),
    ]),
    displayedGross,
    conflict,
  };
}

function benefitSource(
  document: ConfirmedDocumentEvidence,
  issues: string[],
): ProfileIncomeSource | null {
  const amountField = field(document, "monthly_benefit");
  const frequency = payPeriod(document.values.benefit_frequency);
  const amount = finiteNumber(amountField?.value);
  if (amount === null || !amountField || !frequency) {
    issues.push(`Benefit letter ${document.id} needs monthly benefit and benefit frequency.`);
    return null;
  }
  return {
    id: `benefit:${personKey(document)}`,
    kind: "benefit",
    personName: text(document.values.person_name),
    amount,
    period: frequency,
    formula: `${money(amount)} benefit x ${periodsPerYear(frequency)} ${frequency} periods/year`,
    documentId: document.id,
    documentType: document.documentType,
    evidence: uniqueFields([amountField, field(document, "benefit_frequency")]),
    displayedGross: null,
    conflict: null,
  };
}

function gigSource(
  document: ConfirmedDocumentEvidence,
  issues: string[],
): ProfileIncomeSource | null {
  const receipts = field(document, "gross_receipts");
  const amount = finiteNumber(receipts?.value);
  if (amount === null || !receipts) {
    issues.push(`Gig document ${document.id} has no traceable confirmed gross receipts.`);
    return null;
  }
  return {
    id: `gig:${personKey(document)}`,
    kind: "gig",
    personName: text(document.values.person_name),
    amount,
    period: "monthly",
    formula: `${money(amount)} confirmed gross receipts/month x 12 challenge-fixture months/year`,
    documentId: document.id,
    documentType: document.documentType,
    evidence: [receipts],
    displayedGross: null,
    conflict: null,
  };
}

function newestPerPerson(
  documents: readonly ConfirmedDocumentEvidence[],
): ConfirmedDocumentEvidence[] {
  const selected = new Map<string, ConfirmedDocumentEvidence>();
  for (const document of documents) {
    const key = personKey(document);
    const current = selected.get(key);
    if (!current || recency(document) > recency(current)) selected.set(key, document);
  }
  return [...selected.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function newest(documents: readonly ConfirmedDocumentEvidence[]) {
  return documents.reduce<ConfirmedDocumentEvidence | null>(
    (selected, document) =>
      !selected || recency(document) > recency(selected) ? document : selected,
    null,
  );
}

function recency(document: ConfirmedDocumentEvidence): string {
  return `${document.documentDate ?? ""}|${document.confirmedAt ?? ""}|${document.id}`;
}

function personKey(document: ConfirmedDocumentEvidence): string {
  return text(document.values.person_name)?.trim().toLocaleLowerCase() || `unknown:${document.id}`;
}

function buildChecklist(
  requiredTypes: readonly OrganizerDocumentType[],
  evidence: readonly EvidenceRecord[],
  assessment: ReadinessAssessment,
): ProfileChecklistItem[] {
  const labels = new Map(GOLD_CHECKLIST.map((item) => [item.docType, item.label]));
  return requiredTypes.map((documentType) => {
    const records = evidence.filter((record) => record.documentType === documentType);
    const reasons = assessment.reasons.filter((reason) => reason.documentType === documentType);
    const codes = new Set(reasons.map((reason) => reason.code));
    const status =
      records.length === 0
        ? "missing"
        : codes.has("CONFLICT")
          ? "conflict"
          : codes.has("UNTRACEABLE")
            ? "untraceable"
            : codes.has("EXPIRED")
              ? "expired"
              : "provided";
    return {
      id: documentType,
      label: labels.get(documentType) ?? documentType.replaceAll("_", " "),
      required: true,
      status,
      evidenceIds: records.map((record) => record.id),
      reasons: reasons.map(
        (reason) => `${reason.code}${reason.evidenceId ? `: ${reason.evidenceId}` : ""}`,
      ),
    };
  });
}

function field(document: ConfirmedDocumentEvidence, name: string) {
  return document.fields.find((candidate) => candidate.field === name) ?? null;
}

function evidenceDate(values: Readonly<Record<string, string | number>>): string | null {
  for (const name of ["pay_date", "document_date", "application_date"]) {
    if (typeof values[name] === "string") return values[name];
  }
  return null;
}

function parseSourceBox(raw: Record<string, unknown>): SourceBox | null {
  if (!Number.isInteger(raw.page) || !Array.isArray(raw.bbox) || raw.bbox.length !== 4) return null;
  const bbox = raw.bbox.map(finiteNumber);
  if (bbox.some((value) => value === null)) return null;
  return {
    page: raw.page as number,
    bbox: bbox as [number, number, number, number],
    bboxUnits: typeof raw.bbox_units === "string" ? raw.bbox_units : undefined,
  };
}

function parsePageSize(value: unknown): readonly [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const width = finiteNumber(value[0]);
  const height = finiteNumber(value[1]);
  return width === null || height === null ? null : [width, height];
}

function uniqueFields(
  fields: readonly (ConfirmedFieldEvidence | null)[],
): ConfirmedFieldEvidence[] {
  return fields.filter(isPresent).filter((item, index, all) => all.indexOf(item) === index);
}

function payPeriod(value: unknown): PayPeriod | null {
  return typeof value === "string" && PAY_PERIODS.has(value as PayPeriod)
    ? (value as PayPeriod)
    : null;
}

function periodsPerYear(period: PayPeriod): number {
  return { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, annual: 1 }[period];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function cents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number | null): string {
  return value === null
    ? "unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
}

function numberText(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
