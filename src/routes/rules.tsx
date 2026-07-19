import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Table2, ExternalLink, ArrowRight } from "lucide-react";
import {
  CHALLENGE_DATE,
  EFFECTIVE_DATE,
  GOLD_CHECKLIST,
  INCOME_LIMITS_60_AMI,
  METRO,
  RULE_CORPUS,
  RULE_VERSION,
  SOURCE,
} from "@/lib/corpus";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rules & sources — RealDoor" },
      {
        name: "description",
        content:
          "The exact frozen table and checklist consumed by this build, version metadata, limitations, and official source links.",
      },
    ],
  }),
  component: RulesPage,
});

const fade = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

function RulesPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <main id="main" className="mx-auto max-w-4xl px-6 pt-24 pb-24 md:pt-28">
        <motion.div {...fade}>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Rules & sources
          </p>
          <h1 className="font-serif mt-2 text-4xl md:text-5xl">The frozen corpus, in full view.</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            This page renders the exact exports consumed by the workflow: {RULE_VERSION},
            effective-date metadata {EFFECTIVE_DATE}, for {METRO}. The challenge snapshot is dated{" "}
            {CHALLENGE_DATE}
            and does not update itself at runtime.
          </p>
        </motion.div>

        <motion.section {...fade} className="mt-10 rounded-3xl border bg-card p-8">
          <div className="flex items-center gap-3">
            <Table2 className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-2xl">60% MTSP income limits</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            The threshold table used by the Understand step. Corpus source label: {SOURCE.publisher}
            , {SOURCE.document}, {SOURCE.page}.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="border-b py-3 pr-4">Household size</th>
                  <th className="border-b py-3 pr-4">Annual limit (60% AMI)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(INCOME_LIMITS_60_AMI).map(([hh, limit]) => (
                  <tr key={hh}>
                    <td className="border-b py-3 pr-4 font-mono">{hh}</td>
                    <td className="border-b py-3 pr-4 font-mono">${limit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            These values are frozen from the official HUD source linked in the corpus. Verify the
            geography, effective date, applicable AMI band, and current publication before
            real-world use. A threshold comparison is not an eligibility determination.
          </p>
        </motion.section>

        <motion.section {...fade} className="mt-8 rounded-3xl border bg-card p-8">
          <h2 className="font-serif text-2xl">Frozen pack checklist</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The exact checklist export used by the Prepare step. It is a challenge-pack readiness
            baseline, not a universal application requirement; a property or program may request
            different evidence.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {GOLD_CHECKLIST.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between rounded-xl border p-4 text-sm"
              >
                <span>{c.label}</span>
                <span
                  className={`ml-3 text-[11px] uppercase tracking-widest ${c.required ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {c.required ? "Required" : "Optional"}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section {...fade} className="mt-8 rounded-3xl border bg-card p-8">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-2xl">Exact rule corpus</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Entries are shown in exported order. Authority labels distinguish official source
            statements from hackathon simulation conventions.
          </p>
          <ul className="mt-5 space-y-3">
            {RULE_CORPUS.map((rule) => (
              <li key={rule.rule_id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span>{rule.rule_id}</span>
                  <span className="rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {rule.authority.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm">{rule.text}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {rule.source_locator}
                  {rule.effective_date ? ` · Effective ${rule.effective_date}` : ""}
                </p>
                {rule.source_url.startsWith("https://") ? (
                  <a
                    href={rule.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
                  >
                    Open official source <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                    Pack source: {rule.source_url}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </motion.section>

        <div className="mt-12">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background hover:opacity-90"
          >
            Take these rules into the workflow <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
