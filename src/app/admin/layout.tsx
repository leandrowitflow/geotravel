import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireStaff } from "@/lib/auth/require-staff";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaff();
  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950">
      <header className="border-b border-stone-200 bg-[#0f3d3a] text-white dark:border-stone-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin/cases" className="font-semibold tracking-tight">
              Geotravel Admin
            </Link>
            <nav className="flex gap-4 text-sm text-teal-100">
              <Link href="/admin/bookings" className="hover:text-white">
                Bookings
              </Link>
              <Link href="/admin/cases" className="hover:text-white">
                Cases
              </Link>
              <Link href="/admin/quality" className="hover:text-white">
                Quality
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-teal-100/90 sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
