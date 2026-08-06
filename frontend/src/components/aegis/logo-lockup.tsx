import { LogoMark, type LogoVariant } from "./logo-mark";
import { cn } from "@/lib/utils";

export function LogoLockup({
  variant = "primary",
  className,
  markClassName,
  compactOnNarrow = false,
}: {
  variant?: LogoVariant;
  className?: string;
  markClassName?: string;
  compactOnNarrow?: boolean;
}) {
  const reversed = variant === "reversed";

  return (
    <span
      role="img"
      aria-label="Aegis Markets"
      className={cn("inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap", className)}
    >
      <LogoMark variant={variant} className={markClassName} />
      <span
        className={cn(
          "inline-flex items-baseline gap-1.5 leading-none",
          compactOnNarrow && "max-[340px]:hidden",
        )}
      >
        <span
          className={cn(
            "display text-[1.35rem]",
            reversed ? "text-ink-foreground" : "text-foreground",
          )}
        >
          Aegis
        </span>
        <span
          className={cn(
            "font-sans text-[0.58rem] font-medium uppercase tracking-[0.2em]",
            reversed ? "text-ink-foreground/60" : "text-muted-foreground",
          )}
        >
          Markets
        </span>
      </span>
    </span>
  );
}
