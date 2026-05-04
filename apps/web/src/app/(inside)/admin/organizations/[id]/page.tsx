import { redirect } from "next/navigation";

interface OrganizationDetailIndexPageProps {
  params: { id: string };
}

export default function OrganizationDetailIndexPage({
  params,
}: OrganizationDetailIndexPageProps) {
  redirect(`/admin/organizations/${params.id}/members`);
}
