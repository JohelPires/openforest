import { CloudRain, Sun } from "lucide-react";
import { PainelPageHeader } from "@/components/features/painel-page-header";
import { InstrumentStrip } from "@/components/features/instrument-strip";
import { StatRow } from "@/components/features/stat-row";
import { AreaTimeline } from "@/components/features/area-timeline";
import { AREAS } from "@/lib/mock-data";
import { CadernoCampo } from "@/components/features/caderno-campo";
import { Reveal } from "@/components/reveal";

function seasonChip(): { label: string; icon: typeof Sun } {
  const month = new Date().getMonth();
  const rainy = month >= 9 || month <= 2;
  return rainy
    ? { label: "Estação das chuvas", icon: CloudRain }
    : { label: "Estação seca", icon: Sun };
}

function todayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PainelPage() {
  const season = seasonChip();
  const SeasonIcon = season.icon;

  return (
    <div className="space-y-12">
      <PainelPageHeader
        eyebrow={`Núcleo de observação · ${todayLabel()}`}
        title="Visão geral"
        sub="Sensores ao vivo, indicadores e o histórico de cada área na mesma régua de tempo."
        trailing={
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest">
            <SeasonIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {season.label}
          </span>
        }
      />

      <Reveal>
        <InstrumentStrip />
      </Reveal>

      <Reveal delay={80}>
        <StatRow />
      </Reveal>

      <AreaTimeline areas={AREAS} />

      <CadernoCampo />
    </div>
  );
}
