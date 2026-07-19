import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FileText, Gauge, Workflow } from "lucide-react";
import { ProfileSection } from "@/features/ProfileSection";
import { UnderstandSection } from "@/features/UnderstandSection";
import { PrepareSection } from "@/features/PrepareSection";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Workflow — RealDoor" },
      {
        name: "description",
        content:
          "Review model-extracted evidence, run deterministic threshold math, and inspect document gaps. No eligibility decision is made.",
      },
    ],
  }),
  component: AppPage,
});

const TABS = [
  { id: "profile", label: "Profile", sub: "Upload & extract", icon: FileText },
  { id: "understand", label: "Understand", sub: "Threshold math", icon: Gauge },
  { id: "prepare", label: "Prepare", sub: "Packet & gaps", icon: Workflow },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AppPage() {
  const [tab, setTab] = useState<TabId>("profile");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncHash = () => {
      const requested = window.location.hash.slice(1);
      if (TABS.some((item) => item.id === requested)) setTab(requested as TabId);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function selectTab(nextTab: TabId, moveFocus: "tab" | "panel" = "tab") {
    setTab(nextTab);
    window.history.replaceState(null, "", `#${nextTab}`);
    const index = TABS.findIndex((item) => item.id === nextTab);
    requestAnimationFrame(() => {
      if (moveFocus === "panel") panelRef.current?.focus();
      else tabRefs.current[index]?.focus();
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    selectTab(TABS[nextIndex].id);
  }

  return (
    <div className="min-h-dvh">
      <main id="main" className="mx-auto max-w-4xl px-6 pt-24 pb-24 md:pt-28">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workflow</p>
        <h1 className="font-serif mt-2 text-4xl md:text-5xl">
          Prepare your application, step by step.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Three stages, one page. Move through them in order — each stage feeds the next with
          confirmed values, never raw guesses.
        </p>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Stage {TABS.findIndex((item) => item.id === tab) + 1} of {TABS.length}:{" "}
          {TABS.find((item) => item.id === tab)?.label}
        </p>

        <div
          role="tablist"
          aria-label="Workflow stages"
          aria-orientation="horizontal"
          className="mt-8 grid grid-cols-3 gap-2 rounded-2xl border bg-card p-2"
        >
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(element) => {
                  tabRefs.current[i] = element;
                }}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(t.id, "panel")}
                onKeyDown={(event) => handleTabKeyDown(event, i)}
                className={`relative flex flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-colors ${
                  active ? "bg-foreground text-background" : "hover:bg-foreground/5"
                }`}
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
                  <Icon className="h-3.5 w-3.5" /> Step 0{i + 1}
                </div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className={`text-xs ${active ? "opacity-80" : "text-muted-foreground"}`}>
                  {t.sub}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          <div
            key={tab}
            ref={panelRef}
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
          >
            {tab === "profile" && <ProfileSection />}
            {tab === "understand" && <UnderstandSection />}
            {tab === "prepare" && <PrepareSection />}
          </div>
        </div>

        <div className="mt-10 flex justify-between text-sm">
          <button
            onClick={() => {
              const i = TABS.findIndex((t) => t.id === tab);
              if (i > 0) selectTab(TABS[i - 1].id, "panel");
            }}
            disabled={tab === TABS[0].id}
            className="underline underline-offset-4 disabled:opacity-30"
          >
            ← Previous stage
          </button>
          <button
            onClick={() => {
              const i = TABS.findIndex((t) => t.id === tab);
              if (i < TABS.length - 1) selectTab(TABS[i + 1].id, "panel");
            }}
            disabled={tab === TABS[TABS.length - 1].id}
            className="underline underline-offset-4 disabled:opacity-30"
          >
            Next stage →
          </button>
        </div>
      </main>
    </div>
  );
}
