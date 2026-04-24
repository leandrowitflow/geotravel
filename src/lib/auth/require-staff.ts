import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["admin", "operator", "supervisor"] as const;

function staffRole(user: User): string | undefined {
  const fromApp = user.app_metadata?.role;
  const fromUser = user.user_metadata?.role;
  if (typeof fromApp === "string") return fromApp;
  if (typeof fromUser === "string") return fromUser;
  return undefined;
}

export async function requireStaff(): Promise<User> {
  // Dev bypass: skip auth when Supabase is unavailable locally.
  if (process.env.DEV_BYPASS_AUTH === "true") {
    return { id: "dev", email: "dev@local" } as unknown as User;
  }

  const supabase = await createClient();
  if (!supabase) {
    redirect("/sign-in");
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/sign-in");
  }
  const role = staffRole(user);
  const bootstrap =
    process.env.ADMIN_BOOTSTRAP_EMAILS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const email = user.email ?? undefined;
  if (role && ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return user;
  }
  if (email && bootstrap.includes(email)) {
    return user;
  }
  redirect("/unauthorized");
}
