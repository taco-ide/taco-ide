import { AvatarSquare } from "./avatar-square";

interface UserCellProps {
  name: string;
  email: string;
  image?: string | null;
}

export function UserCell({ name, email, image }: UserCellProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <AvatarSquare name={name} src={image} size="md" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-white">{name}</span>
        <span className="truncate text-xs text-slate-400">{email}</span>
      </div>
    </div>
  );
}
