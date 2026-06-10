/** Render a draft with the disclosure line highlighted (R3 — reviewers verify it at a glance). */
export function DraftBody({ body }: { body: string }) {
  const lines = body.split("\n");
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        const isDisclosure = /disclosure/i.test(line) && line.trim().length > 0;
        return (
          <span
            key={i}
            className={
              isDisclosure
                ? "block rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-300"
                : undefined
            }
          >
            {line}
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}
