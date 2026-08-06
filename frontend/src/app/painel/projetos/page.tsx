import { FolderTree } from "lucide-react";
import { PainelPageHeader } from "@/components/features/painel-page-header";
import { PainelEmpty } from "@/components/features/painel-empty";

export default function ProjetosPage() {
  return (
    <div className="space-y-10">
      <PainelPageHeader
        eyebrow="Organização"
        title="Projetos"
        sub="Os projetos agrupam suas áreas de restauração e organizam as equipes que atuam em cada frente."
      />
      <PainelEmpty
        eyebrow="Organização"
        title="Nenhum projeto cadastrado"
        icon={FolderTree}
      >
        Quando você cadastrar o primeiro projeto, ele aparece aqui com as
        métricas agregadas das suas áreas. Comece criando um projeto para a
        sua próxima restauração.
      </PainelEmpty>
    </div>
  );
}
