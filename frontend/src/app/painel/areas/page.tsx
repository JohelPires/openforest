import { Map } from "lucide-react";
import { PainelPageHeader } from "@/components/features/painel-page-header";
import { PainelEmpty } from "@/components/features/painel-empty";

export default function AreasPage() {
  return (
    <div className="space-y-10">
      <PainelPageHeader
        eyebrow="Organização"
        title="Áreas"
        sub="Cada área cadastrada ganha uma faixa própria na linha do tempo do painel — bioma, tamanho e histórico de visitas."
      />
      <PainelEmpty
        eyebrow="Organização"
        title="Suas áreas aparecem aqui"
        icon={Map}
      >
        Cadastre um projeto e depois as áreas que ele abrange. Cada área entra
        na régua de tempo com as visitas de monitoramento já registradas.
      </PainelEmpty>
    </div>
  );
}
