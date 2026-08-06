import type { ReactNode } from "react";

interface PainelPageHeaderProps {
  eyebrow: string;
  title: string;
  sub?: string;
  trailing?: ReactNode;
}

export function PainelPageHeader({
  eyebrow,
  title,
  sub,
  trailing,
}: PainelPageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
          {eyebrow}
        </p>
        <h1 className="font-heading mt-3 text-3xl leading-[1.05] tracking-tight text-forest sm:text-4xl">
          {title}
        </h1>
        {sub ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-moss">
            {sub}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}
