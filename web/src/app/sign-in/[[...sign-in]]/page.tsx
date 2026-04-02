import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f3d3a]">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-in" />
    </div>
  );
}
