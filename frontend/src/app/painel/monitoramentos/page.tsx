import { ClipboardList } from "lucide-react";
import { PainelPageHeader } from "@/components/features/painel-page-header";
import { PainelEmpty } from "@/components/features/painel-empty";

export default function MonitoramentosPage() {
  return (
    <div className="space-y-10">
      <PainelPageHeader
        eyebrow="Campo"
        title="Monitoramentos"
        sub="Cada visita registra notas, mudas contadas, altura média, espécies e fotos — tudo entra no caderno de campo."
      />
      <PainelEmpty
        eyebrow="Campo"
        title="Nenhuma visita registrada"
        icon={ClipboardList}
      >
        Use o botão “Novo registro” para anotar a primeira visita de campo.
        O histórico completo de cada área fica reunido aqui.
      </PainelEmpty>
    </div>
  );
}
