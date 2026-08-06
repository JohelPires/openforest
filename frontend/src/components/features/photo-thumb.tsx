import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

const PALETTE = [
  ["#3E6250", "#7A9B7C"],
  ["#B5C9B0", "#5A7A5E"],
  ["#C4A76C", "#3E6250"],
  ["#0E1712", "#4C6B56"],
] as const;

interface PhotoThumbProps {
  tone: number;
  label: string;
  className?: string;
}

export function PhotoThumb({ tone, label, className }: PhotoThumbProps) {
  const [from, to] = PALETTE[tone % PALETTE.length];

  return (
    <figure
      className={cn("relative overflow-hidden rounded-lg", className)}
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      <Leaf
        className="absolute -bottom-1 -right-1 h-1/2 w-1/2 text-cream/25"
        aria-hidden="true"
      />
      <figcaption className="absolute inset-x-0 bottom-0 bg-soil/35 px-1.5 py-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-cream/90">
        {label}
      </figcaption>
    </figure>
  );
}
