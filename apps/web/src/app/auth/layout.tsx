"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <Card className="overflow-hidden">
          <CardContent className="grid p-0 md:grid-cols-2">
            <div className="p-6 md:p-8">{children}</div>
            <div className="relative hidden bg-muted md:block">
              <Image
                src="/logoTaco.png"
                alt={t("logoAlt")}
                width={500}
                height={500}
                className="absolute inset-0 h-full w-full object-scale-down dark:brightness-[0.2] dark:grayscale"
              />
            </div>
          </CardContent>
        </Card>
        <div className="mt-6 text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
          {t.rich("legal", {
            terms: (chunks) => <a href="#">{chunks}</a>,
            privacy: (chunks) => <a href="#">{chunks}</a>,
          })}
        </div>
      </div>
    </div>
  );
}
