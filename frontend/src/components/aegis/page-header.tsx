import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="scroll-mt-20 border-b border-border bg-card/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="display mt-3 text-4xl leading-[1.05] md:text-5xl">{title}</h1>
            {description && (
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
