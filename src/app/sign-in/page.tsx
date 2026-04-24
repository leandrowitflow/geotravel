import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f3d3a] px-4 text-center text-teal-100">
        <p className="max-w-md text-sm">
          Set <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and a client key (
          <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          or{" "}
          <code className="rounded bg-black/30 px-1">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
          </code>
          ) in <code className="rounded bg-black/30 px-1">.env.local</code> at the project root,
          then restart
          the dev server.
        </p>
      </div>
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sp = await searchParams;
  const nextPath = sp.next?.startsWith("/") ? sp.next : "/admin/cases";

  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f3d3a] px-4">
      <SignInForm defaultNext={nextPath} />
    </div>
  );
}
