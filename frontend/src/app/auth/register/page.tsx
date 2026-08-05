import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Criar conta · OpenForest",
  description:
    "Crie sua conta gratuita no OpenForest e comece a monitorar projetos de restauração ambiental.",
};

export default function RegisterPage() {
  return (
    <AuthShell>
      <Reveal delay={100}>
        <p className="mt-10 font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Novo registro
        </p>
        <h1 className="font-heading mt-4 text-4xl leading-[1.05] tracking-tight text-forest sm:text-5xl">
          Plante sua primeira muda.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-moss">
          Crie sua conta gratuita e comece a registrar projetos de restauração
          — do campo ao painel.
        </p>
      </Reveal>

      <Reveal delay={200}>
        <RegisterForm />
      </Reveal>
    </AuthShell>
  );
}
