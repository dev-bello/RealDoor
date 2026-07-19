import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  DOCUMENT_TYPES,
  confirmExtraction,
  extractDocument,
  listExtractions,
  type DocumentType,
  type ExtractionField,
  type FieldName,
} from "@/lib/extract.functions";
import { ensureSession, getCurrentSession } from "@/lib/session";

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  application_summary: "Application summary",
  pay_stub: "Pay stub",
  employment_letter: "Employment letter",
  benefit_letter: "Benefit letter",
  gig_statement: "Gig statement",
  gig_income_corroboration: "Gig income corroboration",
};

const FIELD_LABELS: Record<FieldName, string> = {
  person_name: "Person name",
  household_size: "Household size",
  address: "Address",
  application_date: "Application date",
  pay_date: "Pay date",
  pay_period_start: "Pay period start",
  pay_period_end: "Pay period end",
  pay_frequency: "Pay frequency",
  regular_hours: "Regular hours",
  hourly_rate: "Hourly rate",
  gross_pay: "Gross pay",
  net_pay: "Net pay",
  document_date: "Document date",
  weekly_hours: "Weekly hours",
  monthly_benefit: "Monthly benefit",
  benefit_frequency: "Benefit frequency",
  statement_month: "Statement month",
  gross_receipts: "Gross receipts",
  platform_fees: "Platform fees",
};

type ReviewField = ExtractionField & { review?: "confirmed" | "corrected" };
type Current = {
  id: string;
  fields: ExtractionField[];
  resumed: boolean;
  injectionStatus: "none_detected" | "detected_and_ignored";
};

function injectionStatusFromRaw(raw: unknown): Current["injectionStatus"] {
  if (!raw || typeof raw !== "object" || !("security" in raw)) return "none_detected";
  const security = raw.security;
  return security &&
    typeof security === "object" &&
    "untrusted_instruction_detected" in security &&
    security.untrusted_instruction_detected === true
    ? "detected_and_ignored"
    : "none_detected";
}

function fieldsFromRaw(raw: unknown): ExtractionField[] | null {
  if (!raw || typeof raw !== "object" || !("fields" in raw) || !Array.isArray(raw.fields))
    return null;
  return raw.fields as ExtractionField[];
}

function reviewedFieldsFromRow(raw: unknown, confirmed: unknown): ExtractionField[] | null {
  const fields = fieldsFromRaw(raw);
  if (!fields || !confirmed || typeof confirmed !== "object") return fields;
  const values = confirmed as Record<string, unknown>;
  return fields.map((field) => {
    const confirmedValue = values[field.field];
    return {
      ...field,
      value:
        typeof confirmedValue === "string" || typeof confirmedValue === "number"
          ? confirmedValue
          : field.value,
    };
  });
}

export function ProfileSection() {
  const queryClient = useQueryClient();
  const extract = useServerFn(extractDocument);
  const confirm = useServerFn(confirmExtraction);
  const list = useServerFn(listExtractions);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("application_summary");
  const [syntheticConsent, setSyntheticConsent] = useState(false);
  const [providerConsent, setProviderConsent] = useState(false);
  const [selected, setSelected] = useState<Current | null>(null);
  const [evidence, setEvidence] = useState<{ url: string; mimeType: string; name: string } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (evidence) URL.revokeObjectURL(evidence.url);
    },
    [evidence],
  );

  const extractionsQuery = useQuery({
    queryKey: ["extractions"],
    queryFn: async () => {
      if (!(await getCurrentSession())) return [];
      return list();
    },
  });

  const pendingRows = (extractionsQuery.data ?? []).filter(
    (row) => !row.confirmed_at && fieldsFromRaw(row.raw_json),
  );
  const current =
    selected ??
    (pendingRows[0]
      ? {
          id: pendingRows[0].id,
          fields: fieldsFromRaw(pendingRows[0].raw_json) ?? [],
          resumed: true,
          injectionStatus: injectionStatusFromRaw(pendingRows[0].raw_json),
        }
      : null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      await ensureSession();
      const fileBase64 = await fileToBase64(file);
      const response = await extract({
        data: {
          fileName: file.name,
          mimeType: file.type as "application/pdf" | "image/png" | "image/jpeg",
          fileBase64,
          docType,
          syntheticOnlyConsent: true,
          providerProcessingConsent: true,
        },
      });
      return { response, file };
    },
    onSuccess: ({ response, file }) => {
      setSelected({
        id: response.id,
        fields: response.fields,
        resumed: false,
        injectionStatus: response.injectionStatus,
      });
      setEvidence((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return { url: URL.createObjectURL(file), mimeType: file.type, name: file.name };
      });
      setAnnouncement("Extraction complete. Review each field before saving.");
      queryClient.invalidateQueries({ queryKey: ["extractions"] });
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  const save = useMutation({
    mutationFn: async (fields: Array<ExtractionField & { review: "confirmed" | "corrected" }>) => {
      if (!current) throw new Error("No extraction selected.");
      return confirm({ data: { id: current.id, fields } });
    },
    onSuccess: async () => {
      setAnnouncement("Field review saved successfully.");
      setSelected(null);
      setEvidence((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return null;
      });
      await queryClient.invalidateQueries({ queryKey: ["extractions"] });
    },
  });

  const consentReady = syntheticConsent && providerConsent;
  const uploadError = fileError ?? (upload.error instanceof Error ? upload.error.message : null);
  const queryError =
    extractionsQuery.error instanceof Error ? extractionsQuery.error.message : null;
  const saveError = save.error instanceof Error ? save.error.message : null;

  return (
    <div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">01 / Profile</p>
      <h2 className="font-serif mt-2 text-3xl md:text-4xl">Upload, trace, review</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Extracted values remain pending until you compare every field with its cited source. Raw
        documents are never stored.
      </p>

      <section aria-labelledby="upload-heading" className="mt-6 rounded-2xl border bg-card p-6">
        <h3 id="upload-heading" className="text-lg font-medium">
          Process a synthetic document
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, PNG, or JPEG, up to 5 MB. Letter-size evidence only.
        </p>

        <div className="mt-4 space-y-3 rounded-xl border bg-secondary/30 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={syntheticConsent}
              onChange={(event) => setSyntheticConsent(event.target.checked)}
              className="mt-1"
            />
            <span>
              I confirm this is an organizer-provided synthetic document and contains no real
              personal data.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={providerConsent}
              onChange={(event) => setProviderConsent(event.target.checked)}
              className="mt-1"
            />
            <span>
              I consent to sending this synthetic document to OpenAI for extraction with response
              storage disabled. OpenAI states API data is not used for training unless the account
              opts in, but abuse-monitoring logs may retain content for up to 30 days.
            </span>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[220px,1fr] sm:items-end">
          <div>
            <label htmlFor="doc-type" className="block text-xs font-medium">
              Document type
            </label>
            <select
              id="doc-type"
              value={docType}
              onChange={(event) => setDocType(event.target.value as DocumentType)}
              disabled={upload.isPending}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="doc-file" className="block text-xs font-medium">
              Choose source document
            </label>
            <input
              id="doc-file"
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={upload.isPending || !consentReady}
              onChange={(event) => {
                setFileError(null);
                const file = event.target.files?.[0];
                if (!file) return;
                if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
                  setFileError("Choose a PDF, PNG, or JPEG synthetic document.");
                  event.target.value = "";
                  return;
                }
                if (file.size > 5 * 1024 * 1024) {
                  setFileError("The document exceeds the 5 MB limit.");
                  event.target.value = "";
                  return;
                }
                upload.mutate(file);
              }}
              className="mt-1 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-background hover:file:bg-accent disabled:opacity-50"
            />
          </div>
        </div>
        {!consentReady && (
          <p className="mt-3 text-xs text-muted-foreground">
            Both confirmations are required before upload.
          </p>
        )}
        {upload.isPending && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Extracting and validating evidence...
          </p>
        )}
        {uploadError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {uploadError}
          </p>
        )}
      </section>

      {current && (
        <ConfirmForm
          key={current.id}
          initial={current.fields}
          resumed={current.resumed}
          injectionStatus={current.injectionStatus}
          evidence={evidence}
          onSave={(fields) => save.mutate(fields)}
          saving={save.isPending}
          error={saveError}
        />
      )}

      <section aria-labelledby="previous-heading" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="previous-heading" className="text-lg font-medium">
            Extraction history
          </h3>
          {pendingRows.length > 0 && (
            <span className="text-xs text-amber-700">{pendingRows.length} pending review</span>
          )}
        </div>
        {extractionsQuery.isPending && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Loading extractions...
          </p>
        )}
        {queryError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {queryError}
          </p>
        )}
        {extractionsQuery.data && extractionsQuery.data.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {extractionsQuery.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
              >
                <div>
                  <p className="font-medium">
                    {DOCUMENT_LABELS[row.doc_type as DocumentType] ?? row.doc_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.confirmed_at
                      ? `Reviewed ${new Date(row.confirmed_at).toLocaleString()}`
                      : "Awaiting field review"}
                    {row.corrected ? " / corrected" : ""}
                  </p>
                </div>
                {!row.confirmed_at && fieldsFromRaw(row.raw_json) && current?.id !== row.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelected({
                        id: row.id,
                        fields: fieldsFromRaw(row.raw_json) ?? [],
                        resumed: true,
                        injectionStatus: injectionStatusFromRaw(row.raw_json),
                      })
                    }
                    className="rounded-full border px-4 py-2 text-xs hover:bg-secondary"
                  >
                    Resume review
                  </button>
                )}
                {row.confirmed_at && fieldsFromRaw(row.raw_json) && current?.id !== row.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelected({
                        id: row.id,
                        fields: reviewedFieldsFromRow(row.raw_json, row.confirmed_json) ?? [],
                        resumed: true,
                        injectionStatus: injectionStatusFromRaw(row.raw_json),
                      })
                    }
                    className="rounded-full border px-4 py-2 text-xs hover:bg-secondary"
                  >
                    Review or correct
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : !extractionsQuery.isPending && !queryError ? (
          <p className="mt-3 text-sm text-muted-foreground">No extractions yet.</p>
        ) : null}
      </section>
    </div>
  );
}

function ConfirmForm({
  initial,
  resumed,
  injectionStatus,
  evidence,
  onSave,
  saving,
  error,
}: {
  initial: ExtractionField[];
  resumed: boolean;
  injectionStatus: Current["injectionStatus"];
  evidence: { url: string; mimeType: string; name: string } | null;
  onSave: (fields: Array<ExtractionField & { review: "confirmed" | "corrected" }>) => void;
  saving: boolean;
  error: string | null;
}) {
  const [fields, setFields] = useState<ReviewField[]>(initial);
  const [selectedFieldName, setSelectedFieldName] = useState<FieldName | null>(
    initial[0]?.field ?? null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const lowConfidence = fields.some((field) => field.confidence < 0.7);
  const allReviewed = fields.length > 0 && fields.every((field) => field.review);

  const updateValue = (index: number, rawValue: string) => {
    setFields((previous) =>
      previous.map((field, fieldIndex) => {
        if (fieldIndex !== index) return field;
        const value =
          typeof field.value === "number"
            ? rawValue === ""
              ? Number.NaN
              : Number(rawValue)
            : rawValue;
        return {
          ...field,
          value,
          review: value === initial[index]?.value ? "confirmed" : "corrected",
        };
      }),
    );
    setValidationError(null);
  };

  const submit = () => {
    const invalid = fields.find(
      (field) =>
        (typeof field.value === "string" && !field.value.trim()) ||
        (typeof field.value === "number" && (!Number.isFinite(field.value) || field.value < 0)) ||
        (field.field === "household_size" && !Number.isInteger(field.value)),
    );
    if (invalid) {
      setValidationError(`${FIELD_LABELS[invalid.field]} has an invalid normalized value.`);
      return;
    }
    if (!allReviewed) {
      setValidationError("Confirm or correct every field before saving.");
      return;
    }
    onSave(fields as Array<ExtractionField & { review: "confirmed" | "corrected" }>);
  };

  return (
    <section aria-labelledby="review-heading" className="mt-6 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="review-heading" className="text-lg font-medium">
            Field-level evidence review
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm each normalized value against its page and coordinates.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            injectionStatus === "detected_and_ignored"
              ? "border-amber-700/40 bg-amber-600/10 text-amber-900"
              : "border-emerald-700/30 bg-emerald-700/10 text-emerald-800"
          }`}
        >
          {injectionStatus === "detected_and_ignored"
            ? "Embedded instruction detected and ignored; no instruction text retained"
            : "No embedded instruction detected"}
        </span>
      </div>

      {resumed && (
        <p role="status" className="mt-4 rounded-md bg-secondary p-3 text-sm">
          Pending extraction resumed from saved evidence. The original file was not stored; reselect
          it in a new upload if you need the visual preview.
        </p>
      )}
      {lowConfidence && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm"
        >
          Uncertain evidence: one or more fields are below 70% confidence. Check their coordinates
          carefully.
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr),minmax(280px,0.85fr)]">
        <div className="space-y-3">
          {fields.map((field, index) => (
            <article
              key={field.field}
              className={`rounded-xl border p-4 ${field.confidence < 0.7 ? "border-amber-600/50" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`field-${field.field}`} className="text-sm font-medium">
                  {FIELD_LABELS[field.field]}
                </label>
                <span
                  className={
                    field.confidence < 0.7
                      ? "text-xs font-semibold text-amber-700"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {Math.round(field.confidence * 100)}% confidence
                </span>
              </div>
              <input
                id={`field-${field.field}`}
                type={
                  typeof field.value === "number"
                    ? "number"
                    : DATE_FIELD_NAMES.has(field.field)
                      ? "date"
                      : "text"
                }
                min={typeof field.value === "number" ? 0 : undefined}
                step={
                  field.field === "household_size"
                    ? 1
                    : typeof field.value === "number"
                      ? "any"
                      : undefined
                }
                value={Number.isNaN(field.value) ? "" : field.value}
                onChange={(event) => updateValue(index, event.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                Page {field.page} / bbox [{field.bbox.join(", ")}] / page [612, 792] /{" "}
                {field.bbox_units}
              </p>
              <button
                type="button"
                onClick={() => setSelectedFieldName(field.field)}
                aria-pressed={selectedFieldName === field.field}
                className="mt-3 rounded-full border px-3 py-1 text-xs hover:bg-secondary aria-pressed:bg-foreground aria-pressed:text-background"
              >
                Show source box
              </button>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(field.review)}
                  onChange={(event) =>
                    setFields((previous) =>
                      previous.map((item, fieldIndex) =>
                        fieldIndex === index
                          ? {
                              ...item,
                              review: event.target.checked
                                ? item.value === initial[index]?.value
                                  ? "confirmed"
                                  : "corrected"
                                : undefined,
                            }
                          : item,
                      ),
                    )
                  }
                />
                I checked this value against the cited evidence
                {field.review === "corrected" ? " (corrected)" : ""}
              </label>
            </article>
          ))}
        </div>

        <EvidencePreview
          evidence={evidence}
          field={fields.find((field) => field.field === selectedFieldName) ?? fields[0] ?? null}
        />
      </div>

      {(validationError || error) && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {validationError ?? error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={saving || !allReviewed}
        className="mt-6 rounded-full bg-foreground px-5 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving review..." : "Save reviewed fields"}
      </button>
    </section>
  );
}

function EvidencePreview({
  evidence,
  field,
}: {
  evidence: { url: string; mimeType: string; name: string } | null;
  field: ReviewField | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!evidence || evidence.mimeType !== "application/pdf" || !field || !canvasRef.current)
      return;
    let cancelled = false;
    let destroyLoadingTask: (() => Promise<void>) | undefined;

    void (async () => {
      try {
        setRenderError(null);
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const loadingTask = pdfjs.getDocument({ url: evidence.url });
        destroyLoadingTask = () => loadingTask.destroy();
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(field.page);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable.");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
      } catch {
        if (!cancelled) setRenderError("The local PDF preview could not be rendered.");
      }
    })();

    return () => {
      cancelled = true;
      void destroyLoadingTask?.();
    };
  }, [evidence, field]);

  return (
    <aside
      aria-label="Local source preview"
      className="min-h-80 overflow-hidden rounded-xl border bg-secondary/30"
    >
      {evidence && field ? (
        <>
          <p className="border-b p-3 text-xs text-muted-foreground">
            Local-only preview: {evidence.name}. Highlighting {FIELD_LABELS[field.field]} on page{" "}
            {field.page}.
          </p>
          <div className="relative mx-auto aspect-[612/792] w-full bg-white">
            {evidence.mimeType === "application/pdf" ? (
              <canvas ref={canvasRef} className="block h-full w-full object-contain" />
            ) : (
              <img
                src={evidence.url}
                alt={`Source page for ${FIELD_LABELS[field.field]}`}
                className="block h-full w-full object-contain"
              />
            )}
            <div
              aria-label={`Evidence box for ${FIELD_LABELS[field.field]}`}
              className="pointer-events-none absolute border-2 border-red-600 bg-red-500/15 shadow-[0_0_0_1px_white]"
              style={boxStyle(field.bbox)}
            />
          </div>
          {renderError && (
            <p role="alert" className="p-3 text-xs text-destructive">
              {renderError}
            </p>
          )}
        </>
      ) : (
        <div className="grid min-h-80 place-items-center p-6 text-center text-sm text-muted-foreground">
          Source coordinates remain available, but the original document is intentionally not
          retained after refresh.
        </div>
      )}
    </aside>
  );
}

function boxStyle([x0, y0, x1, y1]: readonly [number, number, number, number]) {
  return {
    left: `${(x0 / 612) * 100}%`,
    top: `${((792 - y1) / 792) * 100}%`,
    width: `${((x1 - x0) / 612) * 100}%`,
    height: `${((y1 - y0) / 792) * 100}%`,
  };
}

const DATE_FIELD_NAMES = new Set<FieldName>([
  "application_date",
  "pay_date",
  "pay_period_start",
  "pay_period_end",
  "document_date",
]);

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("The document could not be read."));
    reader.readAsDataURL(file);
  });
}
