import { Images } from "lucide-react";
import { PainelPageHeader } from "@/components/features/painel-page-header";
import { PainelEmpty } from "@/components/features/painel-empty";

export default function FotosPage() {
  return (
    <div className="space-y-10">
      <PainelPageHeader
        eyebrow="Acervo"
        title="Fotos"
        sub="As fotos enviadas nas visitas formam o acervo da restauração — o mesmo enquadramento, um ano após o outro."
      />
      <PainelEmpty
        eyebrow="Acervo"
        title="Ainda não há fotos"
        icon={Images}
      >
        As fotos anexadas aos registros de monitoramento aparecem aqui. O
        acompanhamento do mesmo ponto ao longo do tempo conta a história da
        recuperação.
      </PainelEmpty>
    </div>
  );
}
