"use client";

import { Suspense } from "react";
import { AcceptInvitation } from "@/components/accept-invitation";

// Target of the invitation email link (packages/infra/src/auth/invitation-email.ts).
// AcceptInvitation reads useSearchParams(), which needs a Suspense boundary.
export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitation />
    </Suspense>
  );
}
