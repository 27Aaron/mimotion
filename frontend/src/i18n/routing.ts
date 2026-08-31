import {
  navigate,
  stripLocale,
  currentLocale,
  usePathname,
  useRouter,
} from "../platform/navigation";

export const routing = {
  locales: ["zh", "en"] as const,
  defaultLocale: "zh" as const,
};

export { usePathname, useRouter };

export function redirect({
  href,
  locale = currentLocale(),
}: {
  href: string;
  locale?: "zh" | "en";
}) {
  navigate(href, locale, true);
}

export { stripLocale };
