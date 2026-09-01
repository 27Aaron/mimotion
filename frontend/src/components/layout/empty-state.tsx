import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <Empty className={cn("min-h-48 rounded-none border-0 p-8", className)}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon className="text-primary" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          {children && (
            <EmptyContent className="max-w-xl">{children}</EmptyContent>
          )}
        </Empty>
      </CardContent>
    </Card>
  );
}
