import * as React from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "@/platform/i18n";
import { Button } from "@/components/ui/button";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const t = useTranslations("nav");
  const transitionTimeout = React.useRef<number | null>(null);
  const transitionId = React.useRef(0);

  React.useEffect(() => () => {
    if (transitionTimeout.current !== null) {
      window.clearTimeout(transitionTimeout.current);
    }
    document.documentElement.classList.remove("theme-transitioning");
  }, []);

  function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement;
    const nextTheme = theme === "light" ? "dark" : "light";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewTransitionDocument = document as ViewTransitionDocument;

    if (!reducedMotion && viewTransitionDocument.startViewTransition) {
      const buttonBounds = event.currentTarget.getBoundingClientRect();
      const x = buttonBounds.left + buttonBounds.width / 2;
      const y = buttonBounds.top + buttonBounds.height / 2;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      const id = ++transitionId.current;

      root.style.setProperty("--theme-reveal-x", `${x}px`);
      root.style.setProperty("--theme-reveal-y", `${y}px`);
      root.style.setProperty("--theme-reveal-radius", `${radius}px`);

      const transition = viewTransitionDocument.startViewTransition(() => {
        flushSync(() => setTheme(nextTheme));
      });
      const cleanup = () => {
        if (transitionId.current !== id) return;
        root.style.removeProperty("--theme-reveal-x");
        root.style.removeProperty("--theme-reveal-y");
        root.style.removeProperty("--theme-reveal-radius");
      };
      void transition.finished.then(cleanup, cleanup);
      return;
    }

    if (!reducedMotion) {
      root.classList.add("theme-transitioning");
      if (transitionTimeout.current !== null) {
        window.clearTimeout(transitionTimeout.current);
      }
      transitionTimeout.current = window.setTimeout(() => {
        root.classList.remove("theme-transitioning");
        transitionTimeout.current = null;
      }, 350);
    }

    setTheme(nextTheme);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={t("toggleTheme")}
    >
      <Sun className="size-4 rotate-0 scale-100 transition-transform duration-150 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-transform duration-150 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{t("toggleTheme")}</span>
    </Button>
  );
}
