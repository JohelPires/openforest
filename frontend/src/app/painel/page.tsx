"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Sprout } from "lucide-react";
import { logout } from "@/lib/api";
import { clearSession, getRefreshToken, getSession } from "@/lib/auth";

export default function PainelPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/auth/login");
    }
  }, [router]);

  async function handleLogout() {
    const refreshToken = getRefreshToken();
    setPending(true);
    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch {
        // best-effort: segue para o logout local mesmo se a API falhar
      }
    }
    clearSession();
    router.replace("/auth/login");
  }

  return (
    <main className="flex min-h-screen flex-col bg-mist">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-cream transition-transform duration-300 group-hover:scale-105">
            <Sprout className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg text-forest">OpenForest</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-cream/60 px-4 py-2 text-sm font-medium text-forest transition-all duration-300 hover:border-forest/40 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          Sair
        </button>
      </nav>

      <section className="relative flex flex-1 items-center justify-center overflow-hidden px-6 pb-24 pt-10">
        <div
          className="hero-mesh pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-xl rounded-3xl border border-forest/10 bg-cream/80 p-10 text-center shadow-xl shadow-forest/5 backdrop-blur-sm sm:p-14">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-cream">
            <Sprout className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-8 font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Painel
          </p>
          <h1 className="font-heading mt-4 text-3xl leading-[1.1] tracking-tight text-forest sm:text-4xl">
            Você está dentro.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-moss">
            O dashboard com seus projetos e áreas de restauração ainda está em
            construção — em breve, seus indicadores vão aparecer aqui.
          </p>
        </div>
      </section>
    </main>
  );
}
