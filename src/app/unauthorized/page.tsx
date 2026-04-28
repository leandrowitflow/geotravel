import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 p-6 dark:bg-stone-950 dark:text-stone-100">
      <h1 className="text-xl font-semibold text-stone-800 dark:text-stone-100">Access denied</h1>
      <p className="text-stone-600 text-center max-w-md dark:text-stone-300">
        Your account is not authorised for the Geotravel admin center. Ask an
        administrator to set your Supabase Auth{" "}
        <code className="rounded bg-stone-200 px-1 dark:bg-stone-800 dark:text-stone-200">app_metadata.role</code> or{" "}
        <code className="rounded bg-stone-200 px-1 dark:bg-stone-800 dark:text-stone-200">user_metadata.role</code> to{" "}
        <em>admin</em>, <em>operator</em>, or <em>supervisor</em>, or add your
        email to <code className="rounded bg-stone-200 px-1 dark:bg-stone-800 dark:text-stone-200">ADMIN_BOOTSTRAP_EMAILS</code>.
      </p>
      <Link href="/" className="text-teal-800 underline dark:text-teal-300">
        Home
      </Link>
    </div>
  );
}
