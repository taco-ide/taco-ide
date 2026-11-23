"use client";

import { Suspense } from "react";
import { SignupForm } from "@/components/signup-form";

// SignupForm reads useSearchParams() (redirect + prefilled email), which
// needs a Suspense boundary for Next.js to prerender the page.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
