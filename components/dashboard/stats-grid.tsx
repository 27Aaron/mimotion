import type { ComponentType, ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatItem {
  id?: string;
  title: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  active?: boolean;
  onClick?: () => void;
}

interface StatsGridProps {
  items: StatItem[];
  className?: string;
  cardClassName?: string;
}

export function StatsGrid({ items, className, cardClassName }: StatsGridProps) {
  return (
    <div className={cn("stats-grid", className)}>
      {items.map((item) => {
        const interactive = Boolean(item.onClick);

        return (
          <Card
            key={item.id ?? item.title}
            className={cn(
              "stat-card",
              interactive && "cursor-pointer transition-all hover:ring-1 hover:ring-border",
              item.active && "ring-2 ring-primary/40",
              cardClassName,
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
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="stat-label">{item.title}</CardTitle>
                <div className={cn("stat-icon-box", item.bg)}>
                  <item.icon className={item.color} />
                </div>
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
