import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/styles/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import App from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <App />
    </ThemeProvider>
  </StrictMode>,
);
