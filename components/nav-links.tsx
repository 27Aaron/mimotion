"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  Clock,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Smartphone,
  Clock,
  Settings,
  Ticket,
  Users,
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function NavLinks({
  items,
  variant = "sidebar",
}: {
  items: NavItem[];
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <>
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = iconMap[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {item.label}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <>
      {items.map((item, i) => {
        const isActive = pathname === item.href;
        const Icon = iconMap[item.icon];
        const isAdminItem = item.icon === "Ticket" || item.icon === "Users";
        const showDivider = isAdminItem && (i === 0 || !["Ticket", "Users"].includes(items[i - 1].icon));
        return (
          <span key={item.href}>
            {showDivider && <div className="fade-divider my-1.5" />}
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`nav-item group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/60 hover:bg-primary/8 hover:text-primary"
              }`}
            >
              {Icon && (
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? "text-primary" : "group-hover:text-primary"
                  }`}
                />
              )}
              {item.label}
            </Link>
          </span>
        );
      })}
    </>
  );
}
