import { cn } from "@/lib/utils";

const palette = [
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-rose-500/20 text-rose-300",
  "bg-cyan-500/20 text-cyan-300",
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % palette.length;
  return palette[idx] ?? palette[0]!;
}

function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

interface AvatarSquareProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AvatarSquare({ name, src, size = "md", className }: AvatarSquareProps) {
  const sizeClass =
    size === "sm"
      ? "h-8 w-8 text-xs rounded-md"
      : size === "lg"
        ? "h-14 w-14 text-lg rounded-xl"
        : "h-10 w-10 text-sm rounded-lg";

  if (src) {
    return (
      <div
        className={cn(
          "shrink-0 overflow-hidden border border-white/10",
          sizeClass,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold border border-white/10",
        sizeClass,
        pickColor(name),
        className,
      )}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}
