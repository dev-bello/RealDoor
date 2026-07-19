import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Check, X, FileText, Gauge, Workflow, ArrowRight, Boxes } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — RealDoor" },
      {
        name: "description",
        content:
          "The pipeline: model-assisted evidence extraction, human confirmation, deterministic comparisons against a frozen corpus, checklist diff, and draft export.",
      },
    ],
  }),
  component: HowItWorks,
});

const fade = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

const STEPS = [
  {
    icon: FileText,
    title: "1. Evidence extraction (AI)",
    body: "A configured model reads the uploaded synthetic document and proposes allowlisted fields: employer name, employee name, gross pay, pay period, pay date, and household size. Model output is untrusted and may be incomplete or wrong.",
  },
  {
    icon: Check,
    title: "2. Human confirmation",
    body: "You compare each proposed field with the source and correct it when needed. Downstream calculations use the confirmed record rather than the raw extraction.",
  },
  {
    icon: Gauge,
    title: "3. Deterministic math (code)",
    body: "Plain code annualizes gross pay by pay period (x52, x26, x24, x12, x1) and looks up the matching household-size row in the build's frozen 60% MTSP table. This threshold comparison is not an eligibility test.",
  },
  {
    icon: Workflow,
    title: "4. Checklist diff & packet",
    body: "Confirmed uploads are compared with the frozen pack checklist. Missing or stale items are surfaced and a draft packet can be exported. Property requirements and official guidance may differ, so a human must verify the result.",
  },
];

function HowItWorks() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <main id="main" className="mx-auto max-w-4xl px-6 pt-24 pb-24 md:pt-28">
        <motion.div {...fade}>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How it works</p>
          <h1 className="font-serif mt-2 text-4xl md:text-5xl">
            A pipeline you can audit end-to-end.
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            RealDoor limits the model to proposing structured evidence. Human confirmation precedes
            deterministic calculations and checklist comparison. The output is a draft for review,
            not a submission-ready or eligibility decision.
          </p>
        </motion.div>

        <ol className="mt-10 grid gap-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.li key={s.title} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }}>
                <div className="flex gap-5 rounded-2xl border bg-card p-6">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-medium">{s.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>

        <motion.section {...fade} className="mt-14 rounded-3xl border bg-card p-8">
          <div className="flex items-center gap-3">
            <Boxes className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-2xl">Evidence boundary</h2>
          </div>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            The extractor accepts only document-specific, purpose-limited fields. Every proposed
            field must include confidence, page number, and a bounded PDF-point source box. The
            original file remains browser-local for visual review and is not persisted by RealDoor.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-xs leading-relaxed">
              {`{
  "field": "gross_pay",
  "value": 2166.00,
  "confidence": 0.94,
  "page": 1,
  "bbox": [340, 528, 397.38, 544],
  "bbox_units": "pdf_points_bottom_left_origin"
}`}
            </pre>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-moss mt-0.5" /> Only the documented field allowlist
                is accepted
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-moss mt-0.5" /> Confirmation is required before
                downstream use
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-moss mt-0.5" /> Document text is treated as untrusted
                data
              </li>
              <li className="flex gap-2">
                <X className="h-4 w-4 text-destructive mt-0.5" /> Confidence is not proof of
                correctness
              </li>
            </ul>
          </div>
        </motion.section>

        <motion.section {...fade} className="mt-10 rounded-3xl border bg-card p-8">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-2xl">Known limitations</h2>
          </div>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Extraction can omit or misread fields and must be checked against the source.</li>
            <li>
              The frozen table and checklist can become outdated or differ from property
              requirements.
            </li>
            <li>
              One pay-period annualization does not account for all income sources, variability, or
              program adjustments.
            </li>
            <li>
              The prototype does not determine eligibility, approval, priority, vacancy, rent, or
              waitlist status.
            </li>
          </ul>
        </motion.section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background hover:opacity-90"
          >
            Try the workflow <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/rules"
            className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium hover:bg-foreground/5"
          >
            See the frozen rules
          </Link>
        </div>
      </main>
    </div>
  );
}
