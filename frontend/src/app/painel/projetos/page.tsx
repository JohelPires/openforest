import { PainelPageHeader } from "@/components/features/painel-page-header";
import { ProjectsSection } from "@/components/features/projects-section";

export default function ProjetosPage() {
  return (
    <div className="space-y-10">
      <PainelPageHeader
        eyebrow="Organização"
        title="Projetos"
        sub="Os projetos agrupam suas áreas de restauração e organizam as equipes que atuam em cada frente."
      />
      <ProjectsSection />
    </div>
  );
}
