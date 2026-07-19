import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, FileText, Gauge, Workflow, ArrowRight, Sparkles, Check, X } from "lucide-react";
import { EFFECTIVE_DATE, METRO } from "@/lib/corpus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RealDoor — An application-readiness copilot for LIHTC housing" },
      {
        name: "description",
        content:
          "Review extracted evidence, run deterministic calculations against a frozen rule snapshot, and identify document gaps. RealDoor does not determine eligibility.",
      },
    ],
  }),
  component: Landing,
});

const fade = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

function Landing() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <BackgroundOrnaments />
      <main id="main" className="relative">
        <Hero />
        <Modules />
        <Boundary />
        <Footer />
      </main>
    </div>
  );
}

function BackgroundOrnaments() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-sky/20 blur-3xl" />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 pt-28 pb-20 md:pt-40 md:pb-28">
      <motion.div
        {...fade}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground"
      >
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        Readiness prototype · frozen rule snapshot
      </motion.div>
      <motion.h1
        {...fade}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="mt-6 font-serif text-5xl leading-[1.02] tracking-tight md:text-7xl"
      >
        Prepare a LIHTC application <span className="italic text-accent">without pretending</span>{" "}
        to decide it.
      </motion.h1>
      <motion.p
        {...fade}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
      >
        Upload a synthetic document, review the extracted fields, and confirm them before use.
        RealDoor then annualizes gross income against its frozen {METRO} 60% MTSP table and checks
        the document list. The result is preparation support, not an eligibility determination.
      </motion.p>
      <motion.div
        {...fade}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mt-8 flex flex-wrap gap-3"
      >
        <Link
          to="/app"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background hover:opacity-90"
        >
          Open the workflow <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/how-it-works"
          className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium hover:bg-foreground/5"
        >
          How it works
        </Link>
      </motion.div>
    </section>
  );
}

const MODULES = [
  {
    to: "/how-it-works" as const,
    icon: FileText,
    kicker: "Read",
    title: "How it works",
    body: "The four-stage pipeline: model-assisted extraction, human confirmation, deterministic math, and a checklist comparison, with its safety boundaries and limitations.",
    cta: "Read the pipeline",
  },
  {
    to: "/rules" as const,
    icon: Gauge,
    kicker: "Reference",
    title: "Rules & sources",
    body: "The exact frozen table and checklist used by this build, their version metadata, verification warning, and links to official HUD sources.",
    cta: "See the corpus",
  },
  {
    to: "/app" as const,
    icon: Workflow,
    kicker: "Do",
    title: "Workflow",
    body: "Upload synthetic evidence, review and confirm suggested fields, compare numbers and document gaps, then export a draft preparation packet.",
    cta: "Open the workflow",
  },
];

function Modules() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <motion.div {...fade} className="mb-10 flex items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Three doors</div>
          <h2 className="mt-2 font-serif text-3xl md:text-4xl">Understand it, or use it.</h2>
        </div>
      </motion.div>
      <div className="grid gap-5 md:grid-cols-3">
        {MODULES.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div key={m.to} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }}>
              <Link
                to={m.to}
                className="group flex h-full flex-col rounded-3xl border bg-card p-6 transition-colors hover:border-foreground/40"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {m.kicker}
                  </span>
                </div>

                <h3 className="mt-6 font-serif text-2xl">{m.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {m.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                  {m.cta}{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Boundary() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <motion.div {...fade} className="rounded-3xl border bg-card p-8 md:p-10">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-accent" />
          <h2 className="font-serif text-2xl md:text-3xl">The boundary</h2>
        </div>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          RealDoor reports evidence, calculations, and checklist status for human review. It does
          not decide eligibility, approval, priority, availability, or whether an application is
          complete under a property's current requirements.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              It will
            </div>
            <ul className="space-y-2 text-sm">
              {[
                "Suggest allowlisted fields for confirmation",
                "Annualize confirmed gross income deterministically",
                "Show the frozen table version used",
                "Compare uploads with the frozen checklist",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="h-4 w-4 text-moss shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              It won't
            </div>
            <ul className="space-y-2 text-sm">
              {[
                "Say “eligible” or “ineligible”",
                "Score, rank, or recommend applicants",
                "Confirm that a property is available",
                "Replace source-document or caseworker review",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-muted-foreground">
        <div>
          App snapshot · Effective date {EFFECTIVE_DATE} · {METRO}
        </div>
        <div>RealDoor prepares. Humans decide.</div>
      </div>
    </footer>
  );
}
