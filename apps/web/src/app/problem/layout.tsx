"use client";

import { UserProvider } from "@/contexts/UserContext";

/**
 * O IDE do problema fica fora de (inside) mas precisa de UserProvider para
 * redirecionar staff (autor / professor titular / coord.) para sessões dos alunos.
 */
export default function ProblemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserProvider>{children}</UserProvider>;
}
