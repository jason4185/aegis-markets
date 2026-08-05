import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function AegisLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
        <Shield className="size-4" strokeWidth={2} />
        <span className="absolute inset-x-1.5 bottom-1 h-px bg-brass/80" />
      </span>
      {showWordmark && (
        <span className="display text-[1.35rem] leading-none text-foreground">
          Aegis
          <span className="ml-1.5 align-middle text-[0.62rem] font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Markets
          </span>
        </span>
      )}
    </span>
  );
}
