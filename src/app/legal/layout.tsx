import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="text-sm font-medium text-teal-800 hover:text-teal-950 dark:text-teal-300 dark:hover:text-teal-200"
          >
            ← Geotravel
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
            <Link href="/legal/terms" className="hover:text-stone-900 dark:hover:text-stone-100">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-stone-900 dark:hover:text-stone-100">
              Privacy
            </Link>
            <Link href="/legal/data-deletion" className="hover:text-stone-900 dark:hover:text-stone-100">
              Data deletion
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
