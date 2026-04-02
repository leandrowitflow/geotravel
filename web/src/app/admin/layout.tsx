import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { requireStaff } from "@/lib/auth/require-staff";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-200 bg-[#0f3d3a] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin/cases" className="font-semibold tracking-tight">
              Geotravel Admin
            </Link>
            <nav className="flex gap-4 text-sm text-teal-100">
              <Link href="/admin/cases" className="hover:text-white">
                Cases
              </Link>
              <Link href="/admin/quality" className="hover:text-white">
                Quality
              </Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
