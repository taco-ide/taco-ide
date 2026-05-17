"use client";
import Footer from "./_components/footer";
import Navbar from "./_components/navbar";
import { NoActiveOrganization } from "./_components/no-active-organization";
import { UserProvider, useUser } from "@/contexts/UserContext";

function InsideShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();

  // Regular users without an active organization can't meaningfully use the
  // app (every org-scoped query will 400/403). Show an explanatory screen
  // instead of letting them sit on a half-broken /explore. Platform admins
  // bypass this because their tooling is global, not org-scoped.
  const showNoOrg =
    !isLoading &&
    !!user &&
    !user.isPlatformAdmin &&
    !user.activeOrganizationId;

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden bg-slate-900">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {showNoOrg ? <NoActiveOrganization /> : children}
      </main>
      <Footer />
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <InsideShell>{children}</InsideShell>
    </UserProvider>
  );
}
