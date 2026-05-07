"use client";
import Footer from "./_components/footer";
import Navbar from "./_components/navbar";
import { UserProvider } from "@/contexts/UserContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden bg-slate-900">
        <Navbar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        <Footer />
      </div>
    </UserProvider>
  );
}
