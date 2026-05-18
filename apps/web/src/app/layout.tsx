import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google"
import { Toaster } from "sonner";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";

const jetbrains = JetBrains_Mono({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "TACO-IDE",
  description:
    "A plataforma inteligente para professores criarem exercícios de Python com suporte de IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`antialiased ${jetbrains.className} text-white bg-slate-900`}
      >
        <QueryProvider>{children}</QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
