import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

import { localizePath, navigate } from "./navigation";

type LinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  }
>;

export default function Link({
  href,
  onClick,
  children,
  ...props
}: LinkProps) {
  const localizedHref = localizePath(href);
  return (
    <a
      href={localizedHref}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          localizedHref.startsWith("/")
        ) {
          event.preventDefault();
          navigate(href);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}
