import type { Metadata } from "next";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { SoilProfile } from "@/components/soil-profile";
import { LoginForm } from "@/components/login-form";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Entrar · OpenForest",
  description:
    "Entre na sua conta do OpenForest para retomar o monitoramento das suas áreas de restauração.",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-mist lg:grid-cols-[1.1fr_1fr]">
      <SoilProfile className="h-64 sm:h-72 lg:h-auto" />

      <section className="relative flex flex-col justify-center overflow-hidden">
        <div
          className="hero-mesh pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-sm px-6 py-12 sm:px-10 sm:py-16">
          <Reveal>
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5 text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-cream transition-transform duration-300 group-hover:scale-105">
                <Sprout className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-heading text-lg text-forest">
                OpenForest
              </span>
            </Link>
          </Reveal>

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
        </div>
      </section>
    </main>
  );
}
