"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ClipboardList,
  FolderTree,
  Images,
  LayoutDashboard,
  Loader2,
  LogOut,
  Map,
  Settings,
  Sprout,
} from "lucide-react";
import { useState } from "react";
import { logout } from "@/lib/api";
import { clearSession, getRefreshToken } from "@/lib/auth";
import { ORGANIZATION } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavigate?: () => void;
}

const MONITORING_NAV = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard },
  { href: "/painel/projetos", label: "Projetos", icon: FolderTree },
  { href: "/painel/areas", label: "Áreas", icon: Map },
  { href: "/painel/monitoramentos", label: "Monitoramentos", icon: ClipboardList },
  { href: "/painel/sensores", label: "Sensores", icon: Activity },
];

const ARCHIVE_NAV = [
  { href: "/painel/fotos", label: "Fotos", icon: Images },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
];

const initials = ORGANIZATION.name
  .split(" ")
  .slice(0, 2)
  .map((word) => word[0])
  .join("");

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/painel") return pathname === "/painel";
    return pathname.startsWith(href);
  }

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
    <div className="flex h-full flex-col">
      <Link
        href="/painel"
        onClick={onNavigate}
        className="group flex items-center gap-2.5 px-5 py-6 text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-cream transition-transform duration-300 group-hover:scale-105">
          <Sprout className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="font-heading text-lg text-forest">OpenForest</span>
      </Link>

      <div className="h-px bg-forest/10" />

      <nav aria-label="Monitoramento" className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
          Monitoramento
        </p>
        <ul className="mt-2 space-y-0.5">
          {MONITORING_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                  isActive(item.href)
                    ? "bg-forest/8 font-medium text-forest"
                    : "text-moss hover:bg-forest/5 hover:text-forest"
                )}
              >
                {isActive(item.href) ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gold"
                  />
                ) : null}
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive(item.href) ? "text-forest" : "text-moss/70"
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-7 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
          Acervo
        </p>
        <ul className="mt-2 space-y-0.5">
          {ARCHIVE_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                  isActive(item.href)
                    ? "bg-forest/8 font-medium text-forest"
                    : "text-moss hover:bg-forest/5 hover:text-forest"
                )}
              >
                {isActive(item.href) ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gold"
                  />
                ) : null}
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive(item.href) ? "text-forest" : "text-moss/70"
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-forest/10 px-3 py-4">
        <div className="flex items-center gap-3 px-2">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest font-mono text-xs font-medium text-cream"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-forest">
              {ORGANIZATION.name}
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-moss/70">
              Monitoramento
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-forest/10 bg-forest/5 px-3 py-2 text-sm font-medium text-forest transition-colors hover:border-forest/25 hover:bg-forest/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          Sair da conta
        </button>
      </div>
    </div>
  );
}
