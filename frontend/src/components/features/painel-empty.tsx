import type { LucideIcon } from "lucide-react";

interface PainelEmptyProps {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export function PainelEmpty({
  eyebrow,
  title,
  icon: Icon,
  children,
}: PainelEmptyProps) {
  return (
    <section className="rounded-2xl border border-forest/10 bg-cream/70 px-6 py-14 text-center shadow-sm shadow-forest/5 sm:px-10 sm:py-16">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/8 text-forest">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-7 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
        {eyebrow}
      </p>
      <h2 className="font-heading mt-3 text-2xl leading-tight tracking-tight text-forest">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-moss">
        {children}
      </p>
    </section>
  );
}
