import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Entrar · OpenForest",
  description:
    "Entre na sua conta do OpenForest para retomar o monitoramento das suas áreas de restauração.",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <Reveal delay={100}>
        <p className="mt-10 font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Acesso ao painel
        </p>
        <h1 className="font-heading mt-4 text-4xl leading-[1.05] tracking-tight text-forest sm:text-5xl">
          De volta ao campo.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-moss">
          Entre com sua conta para retomar o monitoramento das suas áreas e
          ver a recuperação seguir seu curso.
        </p>
      </Reveal>

      <Reveal delay={200}>
        <LoginForm />
      </Reveal>
    </AuthShell>
  );
}
