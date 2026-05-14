import { redirect } from "next/navigation";

interface OrganizationDetailIndexPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationDetailIndexPage({
  params,
}: OrganizationDetailIndexPageProps) {
  const { id } = await params;
  redirect(`/admin/organizations/${id}/members`);
}
