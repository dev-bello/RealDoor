import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { EFFECTIVE_DATE, METRO, SOURCE, type RuleSnippet } from "@/lib/corpus";
import { listExtractions } from "@/lib/extract.functions";
import { buildProfileSummary, type ProfileExtractionRow } from "@/lib/profile-data";
import { answerRulesQuestion } from "@/lib/rules.functions";
import { getCurrentSession } from "@/lib/session";

const PRESETS = [
  "What is the income limit for my household?",
  "What counts as household size?",
  "What documents prove my income?",
  "Just tell me if I qualify",
];

interface RulesAnswer {
  refusal: boolean;
  abstained: boolean;
  message: string;
  snippets: RuleSnippet[];
}

export function UnderstandSection() {
  const list = useServerFn(listExtractions);
  const ask = useServerFn(answerRulesQuestion);
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
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RulesAnswer | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function submit(value: string) {
    const normalized = value.trim();
    if (!normalized || asking) return;
    setAsking(true);
    setQuestionError(null);
    try {
      setAnswer((await ask({ data: { question: normalized } })) as RulesAnswer);
      setQuestion(normalized);
    } catch (error) {
      setAnswer(null);
      setQuestionError(errorMessage(error));
    } finally {
      setAsking(false);
    }
  }

  return (
    <div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {asking
          ? "Looking up the frozen rules."
          : questionError
            ? `Rules lookup failed: ${questionError}`
            : (answer?.message ?? "")}
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">02 / Understand</p>
      <h2 className="font-serif mt-2 text-3xl md:text-4xl">
        The rule, cited. The math, deterministic.
      </h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Confirmed evidence is calculated by code. This comparison reports facts only and never makes
        an eligibility decision.
      </p>

      <section aria-labelledby="calc-heading" className="mt-6 rounded-2xl border bg-card p-6">
        <h3 id="calc-heading" className="text-lg font-medium">
          Confirmed income and published threshold
        </h3>
        {extractionsQuery.isPending ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Loading confirmed evidence...
          </p>
        ) : extractionsQuery.isError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Confirmed evidence could not be loaded: {errorMessage(extractionsQuery.error)}
          </p>
        ) : !summary.hasConfirmedData ? (
          <div className="mt-4 rounded-lg border bg-secondary p-4 text-sm">
            <strong>Not calculated.</strong> Confirm extracted document fields in Profile before an
            income total or threshold comparison can be shown. No example values are substituted.
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <h4 className="font-medium">Recurring sources</h4>
              {summary.incomeSources.length ? (
                <ul className="mt-2 space-y-3">
                  {summary.incomeSources.map((source) => {
                    const included = summary.aggregation.included.find(
                      (item) => item.id === source.id,
                    );
                    return (
                      <li key={source.id} className="rounded-lg border p-4 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <strong className="capitalize">
                            {source.kind}
                            {source.personName ? ` / ${source.personName}` : ""}
                          </strong>
                          <span>
                            {included ? money(included.annualAmount) + " / year" : "Excluded"}
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-xs">{source.formula}</p>
                        <p className="mt-1 font-mono text-xs">
                          Annualized: {money(source.amount)} x {periods(source.period)} ={" "}
                          {included ? money(included.annualAmount) : "not included"}
                        </p>
                        {source.conflict && (
                          <p role="alert" className="mt-2 text-sm text-destructive">
                            Conflict: {source.conflict}
                          </p>
                        )}
                        <EvidenceList documentId={source.documentId} evidence={source.evidence} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No complete confirmed recurring income source can be calculated.
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-secondary p-4 text-sm">
              <p className="font-mono">
                Exact annual total: <strong>{money(summary.annualIncome)}</strong>
              </p>
              <p className="mt-2">
                Household size from confirmed application summary:{" "}
                <strong>{summary.householdSize ?? "not available"}</strong>
              </p>
              {summary.householdEvidence && summary.householdDocumentId && (
                <EvidenceList
                  documentId={summary.householdDocumentId}
                  evidence={[summary.householdEvidence]}
                />
              )}
              {summary.comparison === "not_calculated" || summary.annualIncome === null ? (
                <p className="mt-3 font-medium">
                  Comparison withheld: confirmed, supported household size and calculable income are
                  required.
                </p>
              ) : (
                <p className="mt-3">
                  <strong>Factual comparison:</strong> {money(summary.annualIncome)} is{" "}
                  <strong>
                    {summary.comparison === "below_or_equal" ? "at or below" : "above"}
                  </strong>{" "}
                  the strict {money(summary.threshold)} threshold by{" "}
                  <strong>
                    {money(Math.abs((summary.threshold ?? 0) - summary.annualIncome))}
                  </strong>
                  . Equality is treated as at the threshold.
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                60% AMI / {METRO}. Effective {EFFECTIVE_DATE}. Source: {SOURCE.publisher},{" "}
                <cite>{SOURCE.document}</cite>, {SOURCE.page}.{" "}
                <a
                  href={SOURCE.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Open authoritative HUD source
                </a>
                . This is not an eligibility decision.
              </p>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="qa-heading" className="mt-6 rounded-2xl border bg-card p-6">
        <h3 id="qa-heading" className="text-lg font-medium">
          Ask a rules question
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={asking}
              onClick={() => void submit(preset)}
              className="rounded-full border px-3 py-1 text-xs hover:border-accent disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(question);
          }}
        >
          <label htmlFor="rules-question" className="sr-only">
            Your rules question
          </label>
          <input
            id="rules-question"
            value={question}
            maxLength={600}
            required
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What is the income limit for a household of 3?"
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="rounded-full bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50"
          >
            {asking ? "Looking up..." : "Ask"}
          </button>
        </form>
        {questionError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
          >
            Rules lookup failed: {questionError}
          </p>
        )}
        {answer && (
          <div className="mt-4 rounded-lg border p-4" aria-live="polite" aria-atomic="true">
            <p className="text-sm">
              <strong>
                {answer.refusal
                  ? "Request refused: "
                  : answer.abstained
                    ? "Corpus abstention: "
                    : "Answer: "}
              </strong>
              {answer.message}
            </p>
            {answer.snippets.length > 0 && (
              <ul className="mt-3 space-y-3">
                {answer.snippets.map((snippet) => (
                  <li key={snippet.id} className="rounded-md bg-secondary p-3 text-sm">
                    <p>{snippet.text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {snippet.id} / {snippet.source.publisher} / {snippet.source.page} / Effective{" "}
                      {snippet.effectiveDate ?? "not specified"} /{" "}
                      <a
                        href={snippet.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        Source link
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EvidenceList({
  documentId,
  evidence,
}: {
  documentId: string;
  evidence: readonly {
    field: string;
    sourceBox: {
      page: number;
      bbox: readonly [number, number, number, number];
      bboxUnits?: string;
    };
  }[];
}) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted-foreground" aria-label="Source evidence">
      {evidence.map((item) => (
        <li key={`${documentId}:${item.field}`}>
          Evidence {documentId} / {item.field} / page {item.sourceBox.page} / bbox [
          {item.sourceBox.bbox.join(", ")}]
          {item.sourceBox.bboxUnits ? ` / ${item.sourceBox.bboxUnits}` : ""}
        </li>
      ))}
    </ul>
  );
}

function periods(period: string): number {
  return { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, annual: 1 }[period as "weekly"];
}

function money(value: number | null): string {
  return value === null
    ? "not calculated"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
