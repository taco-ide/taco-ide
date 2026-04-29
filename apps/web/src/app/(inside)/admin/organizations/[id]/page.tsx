"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function OrganizationDetailIndexPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  useEffect(() => {
    if (id) {
      router.replace(`/admin/organizations/${id}/members`);
    }
  }, [id, router]);

  return null;
}
