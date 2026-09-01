import { useEffect, useState } from "react";

export function stripLocale(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(zh|en)(?=\/|$)/, "");
  return withoutLocale || "/";
}

export function currentLocale(): "zh" | "en" {
  const match = window.location.pathname.match(/^\/(zh|en)(?=\/|$)/);
  return match?.[1] === "en" ? "en" : "zh";
}

export function localizePath(path: string, locale = currentLocale()): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("/api/") ||
    /^\/(zh|en)(?=\/|$)/.test(path)
  ) {
    return path;
  }
  return "/" + locale + path;
}

export function navigate(path: string, locale = currentLocale(), replace = false) {
  const nextPath = localizePath(path, locale);
  window.history[replace ? "replaceState" : "pushState"]({}, "", nextPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(() => stripLocale(window.location.pathname));
  useEffect(() => {
    const update = () => setPathname(stripLocale(window.location.pathname));
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return pathname;
}

export function useSearchParams(): URLSearchParams {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return new URLSearchParams(search);
}

export function useRouter() {
  return {
    push: (path: string) => navigate(path),
    replace: (path: string, options?: { locale?: "zh" | "en" }) =>
      navigate(path, options?.locale ?? currentLocale(), true),
    refresh: () => undefined,
  };
}
