import Link from "next/link";
import {
  ArrowRight,
  Code2,
  LineChart,
  MapPin,
  Sprout,
} from "lucide-react";
import { RootNetwork } from "@/components/root-network";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";

const features = [
  {
    icon: MapPin,
    title: "Dados de Campo",
    description:
      "Registre observações, fotos e coordenadas GPS diretamente no campo. Cada dado é salvo com data e localização automaticamente.",
  },
  {
    icon: LineChart,
    title: "Painéis em Tempo Real",
    description:
      "Indicadores ao vivo para cada área restaurada — umidade do solo, temperatura, cobertura de copa e diversidade de espécies num relance.",
  },
  {
    icon: Code2,
    title: "API Aberta",
    description:
      "Acesse todos os dados programaticamente. Integre com suas ferramentas, crie painéis personalizados ou conecte sensores externos.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 overflow-hidden">
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-forest transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-cream transition-transform duration-300 group-hover:scale-105">
            <Sprout className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg text-forest">OpenForest</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-medium text-moss md:flex">
          <Link
            href="#como-funciona"
            className="transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            Como funciona
          </Link>
          <Link
            href="#recursos"
            className="transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            Recursos
          </Link>
          <Link
            href="#painel"
            className="transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            Painel
          </Link>
        </div>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          Entrar
        </Link>
      </nav>

      <section className="relative overflow-hidden">
        <div
          className="hero-mesh pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 text-center sm:px-8 sm:pb-32 sm:pt-28">
          <Reveal>
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-forest/15 bg-cream/70 px-4 py-1.5 text-xs font-medium tracking-wide text-forest/80 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
              </span>
              Plataforma open-source
            </p>
          </Reveal>

          <Reveal delay={100}>
            <h1 className="font-heading mx-auto mt-8 max-w-3xl text-5xl leading-[1.05] tracking-tight text-forest sm:text-6xl lg:text-7xl">
              A restauração,
              <br />
              observada.
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-moss sm:text-xl">
              O OpenForest dá às equipes as ferramentas para acompanhar a
              recuperação ecológica — da primeira amostra de solo ao painel
              vivo.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/register"
                className="group inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-xl hover:shadow-forest/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
              >
                Explorar a plataforma
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-full border border-forest/20 bg-cream/60 px-7 py-3.5 text-sm font-medium text-forest backdrop-blur-sm transition-all duration-300 hover:border-forest/40 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
              >
                Ler a documentação
              </Link>
            </div>
          </Reveal>
        </div>
        <RootNetwork />
      </section>

      <section className="relative mx-auto max-w-6xl px-6 sm:px-8">
        <div className="grid grid-cols-1 divide-y divide-forest/10 rounded-3xl border border-forest/10 bg-cream/70 shadow-sm shadow-forest/5 backdrop-blur-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <p className="font-heading text-4xl font-normal text-forest sm:text-5xl">
              <CountUp value={12847} />
            </p>
            <p className="mt-3 text-sm text-moss/80">árvores monitoradas</p>
          </div>
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <p className="font-heading text-4xl font-normal text-forest sm:text-5xl">
              <CountUp value={340} delay={200} />
            </p>
            <p className="mt-3 text-sm text-moss/80">projetos de restauração</p>
          </div>
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <p className="font-heading text-4xl font-normal text-forest sm:text-5xl">
              <CountUp value={12} delay={400} />
            </p>
            <p className="mt-3 text-sm text-moss/80">países</p>
          </div>
        </div>
      </section>

      <section
        id="como-funciona"
        className="mx-auto max-w-6xl px-6 py-24 sm:px-8 sm:py-32"
      >
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Como funciona
            </p>
            <h2 className="font-heading mt-4 text-3xl font-normal tracking-tight text-forest sm:text-4xl">
              Coletar → Monitorar → Restaurar
            </h2>
            <p className="mt-5 text-base leading-relaxed text-moss sm:text-lg">
              Registre observações de campo com fotos georreferenciadas,
              acompanhe indicadores em tempo real no seu painel e veja os
              ecossistemas se recuperarem ao longo do tempo.
            </p>
          </div>
        </Reveal>
      </section>

      <section id="recursos" className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-8 sm:pb-32">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 120}>
              <div className="group h-full rounded-3xl border border-forest/10 bg-cream/80 p-8 shadow-sm shadow-forest/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-forest/20 hover:shadow-xl hover:shadow-forest/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/8 text-forest transition-colors duration-300 group-hover:bg-forest group-hover:text-cream">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-forest">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-moss/85">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="painel" className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-8 sm:pb-32">
        <Reveal>
          <div className="rounded-3xl border border-forest/10 bg-cream/80 p-6 shadow-xl shadow-forest/5 backdrop-blur-sm sm:p-10">
            <div className="flex items-center justify-between border-b border-forest/10 pb-5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-sage/70" />
                <span className="h-3 w-3 rounded-full bg-gold/70" />
                <span className="h-3 w-3 rounded-full bg-forest/30" />
              </div>
              <p className="text-xs font-medium tracking-wide text-moss/70">
                OpenForest · Painel
              </p>
              <span className="hidden h-6 w-6 rounded-full bg-forest/10 text-forest sm:flex sm:items-center sm:justify-center">
                <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 lg:grid-cols-4">
              <div>
                <p className="font-heading text-3xl font-normal text-forest">
                  1.247
                </p>
                <p className="mt-1.5 text-xs text-moss/70">áreas ativas</p>
              </div>
              <div>
                <p className="font-heading text-3xl font-normal text-forest">
                  89%
                </p>
                <p className="mt-1.5 text-xs text-moss/70">
                  taxa de sobrevivência
                </p>
              </div>
              <div>
                <p className="font-heading text-3xl font-normal text-forest">
                  34
                </p>
                <p className="mt-1.5 text-xs text-moss/70">
                  espécies registradas
                </p>
              </div>
              <div>
                <p className="font-heading text-3xl font-normal text-forest">
                  2,4k
                </p>
                <p className="mt-1.5 text-xs text-moss/70">fotos enviadas</p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 border-t border-forest/10 pt-8 sm:grid-cols-3">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-moss/70">
                    Umidade do solo
                  </p>
                  <p className="font-mono text-xs text-forest">72%</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forest/10">
                  <div
                    className="h-full w-[72%] rounded-full bg-forest"
                    style={{
                      transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-moss/70">
                    Cobertura de copa
                  </p>
                  <p className="font-mono text-xs text-forest">61%</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forest/10">
                  <div
                    className="h-full w-[61%] rounded-full bg-forest"
                    style={{
                      transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-moss/70">
                    Biodiversidade
                  </p>
                  <p className="font-mono text-xs text-forest">84%</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forest/10">
                  <div
                    className="h-full w-[84%] rounded-full bg-forest"
                    style={{
                      transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-sage/20" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-6 py-20 text-center sm:px-8 sm:py-28">
          <Reveal>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Faça parte
              </p>
              <h2 className="font-heading mt-4 text-3xl font-normal tracking-tight text-forest sm:text-5xl">
                Comece a monitorar
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-moss sm:text-lg">
                Junte-se a uma comunidade que acompanha a recuperação dos
                ecossistemas — um registro de campo por vez.
              </p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <Link
              href="/auth/register"
              className="group inline-flex items-center gap-2 rounded-full bg-forest px-8 py-4 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-xl hover:shadow-forest/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
              Criar conta gratuita
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-forest/10 bg-cream/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-10 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5 text-forest">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-cream">
              <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="font-heading text-base">OpenForest</span>
          </div>
          <p className="text-sm text-moss/70">
            Código aberto sob a licença MIT.
          </p>
          <div className="flex items-center gap-6 text-sm font-medium text-moss">
            <Link
              href="/docs"
              className="transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              Documentação
            </Link>
            <Link
              href="https://github.com/"
              className="transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              GitHub
            </Link>
            <Link
              href="/community"
              className="transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              Comunidade
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}