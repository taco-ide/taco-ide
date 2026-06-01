"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGetV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { AdminTopbar } from "./admin-topbar";
import type { BreadcrumbItem } from "./admin-breadcrumbs";

const segmentLabelKeys: Record<string, string> = {
  admin: "segments.admin",
  organizations: "segments.organizations",
  users: "segments.users",
  members: "segments.members",
  domains: "segments.domains",
  settings: "segments.settings",
};

interface SegmentInfo {
  segment: string;
  fullPath: string;
}

function buildSegments(pathname: string): SegmentInfo[] {
  const parts = pathname.split("/").filter(Boolean);
  const out: SegmentInfo[] = [];
  let cumulative = "";
  for (const part of parts) {
    cumulative += `/${part}`;
    out.push({ segment: part, fullPath: cumulative });
  }
  return out;
}

interface AdminRouteBreadcrumbsProps {
  onOpenMobileSidebar?: () => void;
}

/**
 * Builds breadcrumbs from the current pathname for the /admin area.
 * When an org id is in the path, fetches its name to render in place of the id.
 */
export function AdminRouteBreadcrumbs({
  onOpenMobileSidebar,
}: AdminRouteBreadcrumbsProps) {
  const t = useTranslations("admin");
  const pathname = usePathname() ?? "";
  const segments = buildSegments(pathname);

  const orgIndex = segments.findIndex(
    (s, idx) => idx >= 2 && segments[idx - 1]?.segment === "organizations",
  );
  const orgIdSegment = orgIndex >= 0 ? segments[orgIndex] : null;

  const orgQuery = useGetV1OrganizationsId(orgIdSegment?.segment ?? "", {
    query: { enabled: !!orgIdSegment?.segment },
  });
  const orgName = orgQuery.data?.data?.name;

  const items: BreadcrumbItem[] = segments.map(({ segment, fullPath }, idx) => {
    if (orgIdSegment && idx === orgIndex) {
      return {
        label: orgName ?? segment.slice(0, 8),
        href: fullPath,
      };
    }
    const labelKey = segmentLabelKeys[segment];
    const label = labelKey ? t(labelKey) : segment;
    return { label, href: fullPath };
  });

  return (
    <AdminTopbar breadcrumbs={items} onOpenMobileSidebar={onOpenMobileSidebar} />
  );
}
