import { Settings } from "lucide-react";
import { PainelPageHeader } from "@/components/features/painel-page-header";
import { PainelEmpty } from "@/components/features/painel-empty";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-10">
      <PainelPageHeader
        eyebrow="Sistema"
        title="Configurações"
        sub="Preferências da organização, da conta e dos sensores."
      />
      <PainelEmpty
        eyebrow="Sistema"
        title="Em construção"
        icon={Settings}
      >
        Dados da organização, convites de equipe e preferências de
        notificação vão ficar aqui em breve.
      </PainelEmpty>
    </div>
  );
}
