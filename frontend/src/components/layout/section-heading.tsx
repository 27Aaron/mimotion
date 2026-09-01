import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}

export function SectionHeading({
  icon: Icon,
  children,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex min-h-8 items-center gap-2", className)}>
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <h2 className="text-base font-semibold leading-tight">{children}</h2>
    </div>
  );
}
