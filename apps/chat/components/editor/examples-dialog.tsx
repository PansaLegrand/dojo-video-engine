import { Sparkles, X } from "lucide-react";
import type { ReadmeShowcaseExample } from "@/lib/motionforge/readme-showcases";

export function ExamplesDialog({
  templates,
  prompts,
  onLoadTemplate,
  onSelectPrompt,
  onClose,
}: {
  templates: ReadmeShowcaseExample[];
  prompts: string[];
  onLoadTemplate: (example: ReadmeShowcaseExample) => void;
  onSelectPrompt: (prompt: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(220_24%_8%/0.36)] px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="examples-title"
        className="flex max-h-[min(76vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 id="examples-title" className="text-sm font-semibold">
              Examples
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground"
            title="Close examples"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Starter templates
            </h4>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {templates.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => onLoadTemplate(example)}
                  className="rounded-md border border-border bg-white px-3 py-3 text-left hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {example.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {example.scene.width}x{example.scene.height} ·{" "}
                    {example.scene.fps}fps ·{" "}
                    {(example.scene.duration / example.scene.fps).toFixed(1)}s
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {example.description}
                  </span>
                  <span className="mt-2 block truncate font-mono text-[10px] text-muted-foreground">
                    {example.jsonPath}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5 border-t border-border pt-4">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Prompt examples
            </h4>
            <div className="mt-2 grid gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className="w-full rounded-md border border-border bg-white px-3 py-3 text-left text-sm leading-6 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
