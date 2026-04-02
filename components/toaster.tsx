"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      richColors
      position="top-right"
      offset="60px"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
