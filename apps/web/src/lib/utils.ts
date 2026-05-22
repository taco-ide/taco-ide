import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip common Markdown syntax for plain-text previews (card descriptions, etc.).
 * Removes heading hashes, emphasis markers, inline code, links, images, blockquote
 * indicators and collapses whitespace. The result is not a full Markdown parser —
 * it is meant for short summary text, not for rendering content.
 */
export function stripMarkdown(input: string): string {
  if (!input) return "";
  return input
    .replace(/^\s*#{1,6}\s+/gm, "") // ATX headings
    .replace(/^\s*>\s?/gm, "") // blockquote markers
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1") // inline code / fences
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/\s+/g, " ")
    .trim();
}
