import { Suspense } from "react";
import { SignupForm } from "@/modules/auth/components/signup-form";

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
