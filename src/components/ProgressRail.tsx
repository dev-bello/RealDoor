const STEPS = ["01 · Profile", "02 · Understand", "03 · Prepare"] as const;

export function ProgressRail() {
  return (
    <nav aria-label="Workflow stages" className="mx-auto mt-6 max-w-3xl text-sm">
      <ol className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span className="rounded-full border px-3 py-1 text-muted-foreground">{step}</span>
            {index < STEPS.length - 1 && (
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
