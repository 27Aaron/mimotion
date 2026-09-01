import type { ComponentType, ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatItem {
  id?: string;
  title: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}

interface StatsGridProps {
  items: StatItem[];
  className?: string;
}

export function StatsGrid({ items, className }: StatsGridProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      {items.map((item) => {
        const interactive = Boolean(item.onClick);

        return (
          <Card
            key={item.id ?? item.title}
            className={cn(
              "gap-2 py-4",
              interactive && "cursor-pointer transition-colors duration-150 hover:bg-muted/40",
              item.active && "border-primary/50 bg-primary/[0.03]",
            )}
            onClick={item.onClick}
            onKeyDown={interactive ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                item.onClick?.();
              }
            } : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? item.active : undefined}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="stat-label">{item.title}</CardTitle>
                <item.icon className="size-5 text-primary/70" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-1">
              <div className="stat-value">{item.value}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
