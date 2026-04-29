import { AvatarSquare } from "./avatar-square";

interface OrgCellProps {
  name: string;
  slug: string;
  logo?: string | null;
}

export function OrgCell({ name, slug, logo }: OrgCellProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <AvatarSquare name={name} src={logo} size="md" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-white">{name}</span>
        <span className="truncate text-xs text-slate-400">@{slug}</span>
      </div>
    </div>
  );
}
