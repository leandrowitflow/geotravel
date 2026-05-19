"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/data-deletion", label: "User data deletion" },
] as const;

type FooterTheme = "admin" | "dark" | "legal" | "default";

function footerTheme(pathname: string): FooterTheme {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/" || pathname.startsWith("/sign-in")) return "dark";
  if (pathname.startsWith("/legal")) return "legal";
  return "default";
}

const THEME_STYLES: Record<
  FooterTheme,
  { footer: string; link: string; container: string }
> = {
  admin: {
    footer: "bg-[#0f3d3a] px-4 py-3 text-sm text-teal-100",
    link: "underline hover:text-white",
    container: "mx-auto flex max-w-6xl justify-center px-4",
  },
  dark: {
    footer: "bg-[#0c3532] px-4 py-4 text-sm text-teal-200/80",
    link: "underline hover:text-white",
    container: "mx-auto flex max-w-3xl justify-center px-4",
  },
  legal: {
    footer:
      "bg-stone-50 px-4 py-4 text-sm text-stone-600 dark:bg-stone-950 dark:text-stone-400",
    link: "underline hover:text-stone-900 dark:hover:text-stone-100",
    container: "mx-auto flex max-w-3xl justify-center px-4",
  },
  default: {
    footer:
      "bg-stone-50 px-4 py-4 text-sm text-stone-600 dark:bg-stone-950 dark:text-stone-400",
    link: "underline hover:text-stone-900 dark:hover:text-stone-100",
    container: "mx-auto flex max-w-6xl justify-center px-4",
  },
};

export function LegalSiteFooter() {
  const pathname = usePathname() ?? "";
  const theme = footerTheme(pathname);
  const styles = THEME_STYLES[theme];

  return (
    <footer className={styles.footer}>
      <nav className={styles.container} aria-label="Legal">
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {LEGAL_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={styles.link}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
