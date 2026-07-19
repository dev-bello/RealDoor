import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { EFFECTIVE_DATE, METRO, RULE_VERSION, SOURCE } from "@/lib/corpus";
import { deleteAllSessionData, listExtractions } from "@/lib/extract.functions";
import {
  buildProfileSummary,
  type ProfileExtractionRow,
  type ProfileReadinessReason,
  type ProfileSummary,
} from "@/lib/profile-data";
import { endSession, getCurrentSession } from "@/lib/session";

const PACKET_SECTIONS = [
  ["household", "Household size and application evidence"],
  ["incomeSources", "Recurring income sources and formulas"],
  ["comparison", "Annual total and threshold comparison"],
  ["evidence", "Field-level source boxes"],
] as const;
type PacketSection = (typeof PACKET_SECTIONS)[number][0];

export function PrepareSection() {
  const queryClient = useQueryClient();
  const list = useServerFn(listExtractions);
  const deleteSessionData = useServerFn(deleteAllSessionData);
  const extractionsQuery = useQuery({
    queryKey: ["extractions"],
    queryFn: async () => {
      if (!(await getCurrentSession())) return [];
      return list();
    },
  });
  const summary = useMemo(
    () => buildProfileSummary((extractionsQuery.data ?? []) as ProfileExtractionRow[]),
    [extractionsQuery.data],
  );
  const [included, setIncluded] = useState<Record<PacketSection, boolean>>(
    () =>
      Object.fromEntries(PACKET_SECTIONS.map(([key]) => [key, true])) as Record<
        PacketSection,
        boolean
      >,
  );
  const [notes, setNotes] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const result = await deleteSessionData();
      await endSession();
      return result;
    },
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: ["extractions"] });
      setIncluded(
        Object.fromEntries(PACKET_SECTIONS.map(([key]) => [key, true])) as Record<
          PacketSection,
          boolean
        >,
      );
      setNotes("");
      setAnnouncement(
        `Deletion complete and verified: ${result.extractions} extraction records, ${result.auditLogs} audit records, ${result.uploads} uploads, all server sessions, and the anonymous account were removed. This browser's RealDoor session state was cleared.`,
      );
    },
    onError: (error: Error) =>
      setAnnouncement(`Deletion failed: ${error.message} No completion claim has been made.`),
  });
  const packet = useMemo(() => buildPacket(summary, included, notes), [included, notes, summary]);

  return (
    <div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">03 / Prepare</p>
      <h2 className="font-serif mt-2 text-3xl md:text-4xl">Your packet, on your terms.</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The packet uses the same confirmed summary and exact arithmetic shown in Understand. It is
        never sent automatically.
      </p>

      {extractionsQuery.isPending && (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Loading confirmed evidence...
        </p>
      )}
      {extractionsQuery.isError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Confirmed evidence could not be loaded: {errorMessage(extractionsQuery.error)}
        </p>
      )}

      <section aria-labelledby="readiness-heading" className="mt-6 rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="readiness-heading" className="text-lg font-medium">
              Organizer readiness
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Rule {summary.readiness.ruleId}, as of {summary.readiness.asOfDate}. Review readiness
              is not an eligibility decision.
            </p>
          </div>
          <strong
            className={`rounded-full px-3 py-1 text-xs ${summary.readiness.status === "READY_TO_REVIEW" ? "bg-moss/20 text-moss" : "bg-destructive/10 text-destructive"}`}
          >
            {summary.readiness.status}
          </strong>
        </div>

        {summary.readiness.reasons.length > 0 && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <h4 className="font-medium">Reasons review is needed</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {summary.readiness.reasons.map((reason, index) => (
                <li key={`${reason.code}:${index}`}>{readinessReason(reason)}</li>
              ))}
            </ul>
          </div>
        )}

        <h4 className="mt-5 font-medium">Scenario-aware required documents</h4>
        <ul className="mt-2 space-y-2 text-sm">
          {summary.checklist.map((item) => (
            <li key={item.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{item.label}</strong>
                <span className={item.status === "provided" ? "text-moss" : "text-destructive"}>
                  {item.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Evidence: {item.evidenceIds.length ? item.evidenceIds.join(", ") : "none"}
              </p>
              {item.reasons.length > 0 && (
                <p className="mt-1 text-xs text-destructive">{item.reasons.join("; ")}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="evidence-heading" className="mt-6 rounded-2xl border bg-card p-6">
        <h3 id="evidence-heading" className="text-lg font-medium">
          Confirmed evidence used
        </h3>
        {summary.documents.length ? (
          <ul className="mt-3 space-y-3 text-sm">
            {summary.documents.map((document) => (
              <li key={document.id} className="rounded-md border p-3">
                <strong>{document.documentType.replaceAll("_", " ")}</strong>
                <span className="ml-2 text-xs text-muted-foreground">{document.id}</span>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {document.fields.map((field) => (
                    <li key={field.field}>
                      {field.field}: {formatValue(field.value)} / page {field.sourceBox.page} / bbox
                      [{field.sourceBox.bbox.join(", ")}]
                    </li>
                  ))}
                </ul>
                {document.missingEvidenceFields.length > 0 && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    Confirmed values without immutable raw evidence:{" "}
                    {document.missingEvidenceFields.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No confirmed extraction evidence is available. The preview abstains from inserting
            example values.
          </p>
        )}
      </section>

      <section aria-labelledby="packet-heading" className="mt-6 rounded-2xl border bg-card p-6">
        <h3 id="packet-heading" className="text-lg font-medium">
          Packet preview
        </h3>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Structured fields to include</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PACKET_SECTIONS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={included[key]}
                  disabled={key === "evidence"}
                  onChange={(event) =>
                    setIncluded((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                {label}
                {key === "evidence" ? " (required for traceability)" : ""}
              </label>
            ))}
          </div>
        </fieldset>
        <a
          href="#profile"
          className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
        >
          Edit confirmed packet fields in Profile
        </a>
        <label htmlFor="packet-notes" className="mt-4 block text-sm font-medium">
          Packet notes
        </label>
        <textarea
          id="packet-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-2 w-full rounded-md border border-input bg-card p-3 text-sm"
          placeholder="Add questions or context for the organizer."
        />

        <PacketPreview packet={packet} />
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              downloadFile(JSON.stringify(packet, null, 2), "application/json", "json");
              setAnnouncement("Packet JSON download completed.");
            }}
            className="rounded-full bg-foreground px-5 py-2 text-sm text-background hover:opacity-90"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                printPacket(packet);
                setAnnouncement(
                  "The printable packet opened. Use the browser print dialog to print or save it.",
                );
              } catch (error) {
                setAnnouncement(`Print failed: ${errorMessage(error)}`);
              }
            }}
            className="rounded-full border px-5 py-2 text-sm hover:bg-secondary"
          >
            Print packet
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete all session data? This cannot be undone."))
                deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="rounded-full border border-destructive px-5 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete session data"}
          </button>
        </div>
        {announcement && (
          <p
            role={announcement.startsWith("Deletion failed") ? "alert" : "status"}
            aria-live="polite"
            className="mt-4 rounded-md bg-secondary p-3 text-sm"
          >
            {announcement}
          </p>
        )}
      </section>

      <aside aria-label="Rule citation" className="mt-6 text-xs text-muted-foreground">
        Rule version {RULE_VERSION} / Effective {EFFECTIVE_DATE} / {METRO} / {SOURCE.publisher},{" "}
        <cite>{SOURCE.document}</cite>, {SOURCE.page} /{" "}
        <a
          href={SOURCE.url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          authoritative source
        </a>
      </aside>
    </div>
  );
}

function buildPacket(
  summary: ProfileSummary,
  included: Record<PacketSection, boolean>,
  notes: string,
) {
  return {
    packetVersion: 2,
    household_id: summary.householdId,
    generatedAt: new Date().toISOString(),
    readiness: {
      status: summary.readiness.status,
      reasons: summary.readiness.reasons.map(readinessReason),
      ruleId: summary.readiness.ruleId,
      asOfDate: summary.readiness.asOfDate,
      scope: "Organizer review readiness, not an eligibility decision.",
    },
    household: included.household
      ? {
          size: summary.householdSize,
          evidenceDocumentId: summary.householdDocumentId,
          evidence: summary.householdEvidence ?? null,
        }
      : null,
    incomeSources: included.incomeSources
      ? summary.incomeSources.map((source) => ({
          id: source.id,
          kind: source.kind,
          personName: source.personName,
          amount: source.amount,
          period: source.period,
          formula: source.formula,
          annualAmount:
            summary.aggregation.included.find((item) => item.id === source.id)?.annualAmount ??
            null,
          conflict: source.conflict,
          evidenceDocumentId: source.documentId,
        }))
      : null,
    comparison: included.comparison
      ? {
          exactAnnualIncome: summary.annualIncome,
          threshold: summary.threshold,
          result: summary.comparison,
          disclaimer: "This deterministic comparison is not an eligibility decision.",
        }
      : null,
    evidence: summary.documents,
    excludedIncomeSources: summary.aggregation.excluded,
    requiredDocuments: summary.checklist,
    notes: notes.trim(),
    rule: {
      version: RULE_VERSION,
      effectiveDate: EFFECTIVE_DATE,
      metro: METRO,
      citation: SOURCE,
    },
  };
}

type Packet = ReturnType<typeof buildPacket>;

function PacketPreview({ packet }: { packet: Packet }) {
  return (
    <article className="mt-5 rounded-md border bg-card p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-serif text-xl">Application-readiness packet</h4>
        <strong>{packet.readiness.status}</strong>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{packet.readiness.scope}</p>
      <h5 className="mt-5 font-medium">Included summary</h5>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Household size</dt>
          <dd>{packet.household?.size ?? "Not included or unavailable"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Exact annual income</dt>
          <dd>{packet.comparison ? money(packet.comparison.exactAnnualIncome) : "Not included"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Published threshold</dt>
          <dd>{packet.comparison ? money(packet.comparison.threshold) : "Not included"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Comparison</dt>
          <dd>{packet.comparison?.result.replaceAll("_", " ") ?? "Not included"}</dd>
        </div>
      </dl>
      <h5 className="mt-5 font-medium">Income sources</h5>
      {packet.incomeSources?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {packet.incomeSources.map((source) => (
            <li key={source.id}>
              {source.formula} / annual {money(source.annualAmount)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted-foreground">None included or calculable.</p>
      )}
      <h5 className="mt-5 font-medium">Readiness reasons</h5>
      {packet.readiness.reasons.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {packet.readiness.reasons.map((reason, index) => (
            <li key={`${reason}:${index}`}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">No readiness exceptions.</p>
      )}
      <h5 className="mt-5 font-medium">Packet notes</h5>
      <p className="mt-2 whitespace-pre-wrap">{packet.notes || "No notes added."}</p>
    </article>
  );
}

function readinessReason(reason: ProfileReadinessReason): string {
  if (reason.code === "INCOME_CONFLICT" || reason.code === "EXCLUDED_INCOME") return reason.message;
  if (reason.code === "UNSUPPORTED_HOUSEHOLD_SIZE" || reason.code === "MISSING_CONFIRMED_INPUT")
    return reason.message;
  return `${reason.documentType.replaceAll("_", " ")}: ${reason.code.toLowerCase()}${reason.evidenceId ? ` (${reason.evidenceId})` : ""}.`;
}

function printPacket(packet: Packet) {
  const text = (value: unknown) => escapeHtml(String(value ?? "Not available"));
  const list = (items: string[], empty: string) =>
    items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p>${empty}</p>`;
  const incomeSources =
    packet.incomeSources?.map(
      (source) =>
        `<strong>${text(source.personName ?? source.kind)}</strong><br>${text(source.formula)}<br>Annual amount: ${text(money(source.annualAmount))}${source.conflict ? `<br>Review note: ${text(source.conflict)}` : ""}`,
    ) ?? [];
  const requiredDocuments = packet.requiredDocuments.map(
    (document) =>
      `<strong>${text(document.label)}</strong>: ${text(document.status.replaceAll("_", " "))}<br>Evidence: ${text(document.evidenceIds.length ? document.evidenceIds.join(", ") : "None")}${document.reasons.length ? `<br>Review notes: ${text(document.reasons.join("; "))}` : ""}`,
  );
  const evidence = packet.evidence.map(
    (document) =>
      `<strong>${text(document.documentType.replaceAll("_", " "))}</strong> (${text(document.id)})${list(
        document.fields.map(
          (field) =>
            `${text(field.field.replaceAll("_", " "))}: ${text(formatValue(field.value))} (page ${text(field.sourceBox.page)}, box ${text(field.sourceBox.bbox.join(", "))})`,
        ),
        "No confirmed fields.",
      )}`,
  );
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>RealDoor application-readiness packet</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#171717;line-height:1.5}
      h1,h2{font-family:Georgia,serif}h1{margin-bottom:.25rem}h2{margin-top:1.75rem;padding-bottom:.3rem;border-bottom:1px solid #bbb;font-size:1.2rem}
      dl{display:grid;grid-template-columns:max-content 1fr;gap:.35rem 1rem}dt{font-weight:700}dd{margin:0}li{margin:.4rem 0}.notice{padding:.75rem;border:1px solid #999}.notes{white-space:pre-wrap}
      @media print{body{margin:0;max-width:none}h2{break-after:avoid}li{break-inside:avoid}}
    </style>
  </head>
  <body>
    <h1>Application-readiness packet</h1>
    <p class="notice">${text(packet.readiness.scope)}</p>
    <dl>
      <dt>Status</dt><dd>${text(packet.readiness.status.replaceAll("_", " "))}</dd>
      <dt>Generated</dt><dd>${text(new Date(packet.generatedAt).toLocaleString("en-US"))}</dd>
      <dt>Household</dt><dd>${text(packet.household_id)}</dd>
      <dt>Household size</dt><dd>${text(packet.household?.size)}</dd>
      <dt>Annual income</dt><dd>${packet.comparison ? text(money(packet.comparison.exactAnnualIncome)) : "Not included"}</dd>
      <dt>Published threshold</dt><dd>${packet.comparison ? text(money(packet.comparison.threshold)) : "Not included"}</dd>
      <dt>Comparison</dt><dd>${packet.comparison ? text(packet.comparison.result.replaceAll("_", " ")) : "Not included"}</dd>
    </dl>
    <h2>Readiness reasons</h2>
    ${list(packet.readiness.reasons.map(text), "No readiness exceptions.")}
    <h2>Income sources</h2>
    ${list(incomeSources, "No income sources included or calculable.")}
    <h2>Required documents</h2>
    ${list(requiredDocuments, "No required-document information available.")}
    <h2>Confirmed evidence</h2>
    ${list(evidence, "No confirmed evidence available.")}
    <h2>Packet notes</h2>
    <p class="notes">${text(packet.notes || "No notes added.")}</p>
    <h2>Rule source</h2>
    <p>Version ${text(packet.rule.version)}, effective ${text(packet.rule.effectiveDate)}. ${text(packet.rule.metro)}. ${text(packet.rule.citation.publisher)}, <cite>${text(packet.rule.citation.document)}</cite>, ${text(packet.rule.citation.page)}.</p>
  </body>
</html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const frame = document.createElement("iframe");
  frame.title = "Printable RealDoor packet";
  frame.style.display = "none";
  frame.src = url;
  frame.addEventListener(
    "load",
    () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        frame.remove();
        URL.revokeObjectURL(url);
        return;
      }
      printWindow.print();
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    },
    { once: true },
  );
  document.body.append(frame);
}

function downloadFile(contents: string, type: string, extension: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `realdoor-packet-${Date.now()}.${extension}`;
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatValue(value: string | number): string {
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : value;
}

function money(value: number | null): string {
  return value === null
    ? "Not calculated"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ??
      character,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
