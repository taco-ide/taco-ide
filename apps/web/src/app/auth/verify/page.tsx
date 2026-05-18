import { Suspense } from "react";
import { VerifyForm } from "@/components/verify-form";

// VerifyForm uses useSearchParams() which requires a Suspense boundary at
// build time; without it Next.js fails to prerender the page.
export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
