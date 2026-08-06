import { Activity } from "lucide-react";
import { PainelPageHeader } from "@/components/features/painel-page-header";
import { PainelEmpty } from "@/components/features/painel-empty";

export default function SensoresPage() {
  return (
    <div className="space-y-10">
      <PainelPageHeader
        eyebrow="Campo"
        title="Sensores"
        sub="Temperatura, umidade do solo, chuva, luminosidade e qualidade do ar — as leituras ao vivo do seu terreno."
      />
      <PainelEmpty
        eyebrow="Campo"
        title="Sem sensores instalados"
        icon={Activity}
      >
        Quando houver sensores ativos nas suas áreas, as leituras ao vivo
        aparecem aqui, com o histórico de cada medição ao longo do tempo.
      </PainelEmpty>
    </div>
  );
}
