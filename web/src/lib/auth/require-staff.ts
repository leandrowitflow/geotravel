import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["admin", "operator", "supervisor"] as const;

export async function requireStaff() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }
  const role = user.publicMetadata?.role as string | undefined;
  const bootstrap = process.env.ADMIN_BOOTSTRAP_EMAILS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
  const email = user.emailAddresses[0]?.emailAddress;
  if (role && ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return user;
  }
  if (email && bootstrap.includes(email)) {
    return user;
  }
  redirect("/unauthorized");
}
