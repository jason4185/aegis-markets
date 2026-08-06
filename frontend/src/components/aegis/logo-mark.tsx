import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export type LogoVariant = "primary" | "reversed" | "monochrome";

const FRAME_COLOR: Record<LogoVariant, string> = {
  primary: "text-primary",
  reversed: "text-ink-foreground",
  monochrome: "text-current",
};

export function LogoMark({
  variant = "primary",
  className,
  ...props
}: SVGProps<SVGSVGElement> & { variant?: LogoVariant }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cn("size-8 shrink-0", FRAME_COLOR[variant], className)}
      {...props}
    >
      <path
        fill="currentColor"
        d="M24 3.25 40.25 10v13.15c0 9.85-5.9 17.18-16.25 21.6-10.35-4.42-16.25-11.75-16.25-21.6V10L24 3.25Zm0 5.15-11.5 4.78v9.97c0 7.28 3.94 12.7 11.5 16.38 7.56-3.68 11.5-9.1 11.5-16.38v-9.97L24 8.4Z"
      />
      <path
        d="m14.75 27.25 5-5 4.35 3.5 6.15-7.75 3 2.4"
        fill="none"
        stroke={variant === "monochrome" ? "currentColor" : "var(--color-brass)"}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 31.25h18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.46"
      />
    </svg>
  );
}
