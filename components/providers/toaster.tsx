"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      richColors
      position="top-right"
      offset="52px"
      gap={8}
      toastOptions={{
        style: {
          width: "280px",
        },
      }}
      style={{
        right: "12px",
      }}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
