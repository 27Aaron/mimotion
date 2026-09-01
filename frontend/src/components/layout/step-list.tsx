import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StepListProps {
  steps: ReactNode[];
  className?: string;
}

export function StepList({ steps, className }: StepListProps) {
  return (
    <ol
      className={cn(
        "flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li key={index} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-flex size-5 items-center justify-center rounded-full border border-primary/25 text-xs font-semibold leading-none text-primary"
          >
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
