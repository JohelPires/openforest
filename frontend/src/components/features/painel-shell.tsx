"use client";

import { Fragment, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Sidebar } from "@/components/features/sidebar";
import { RegistrationDialog } from "@/components/features/registration-dialog";
import { UserMenu } from "@/components/features/user-menu";
import { UserProvider } from "@/components/features/user-provider";
import {
  BreadcrumbProvider,
  useBreadcrumbSegments,
} from "@/components/features/painel-breadcrumb";

const SECTION_LABELS: Record<string, string> = {
  projetos: "Projetos",
  areas: "Áreas",
  monitoramentos: "Monitoramentos",
  sensores: "Sensores",
  fotos: "Fotos",
  configuracoes: "Configurações",
};

function sectionLabel(pathname: string): string {
  if (pathname === "/painel") return "Visão geral";
  const segment = pathname.replace(/^\/painel\/?/, "").split("/")[0];
  return SECTION_LABELS[segment] ?? "Visão geral";
}

function BreadcrumbNav({ pathname }: { pathname: string }) {
  const segments = useBreadcrumbSegments();

  return (
    <nav aria-label="Trilha de navegação" className="flex min-w-0 items-center gap-2 text-sm">
      {segments.length > 0 ? (
        segments.map((segment, index) => (
          <Fragment key={`${segment}-${index}`}>
            {index > 0 ? (
              <span className="text-moss/40" aria-hidden="true">
                /
              </span>
            ) : null}
            <span
              className={
                index === segments.length - 1
                  ? "truncate font-medium text-forest"
                  : "truncate text-moss/70"
              }
            >
              {segment}
            </span>
          </Fragment>
        ))
      ) : (
        <span className="truncate font-medium text-forest">
          {sectionLabel(pathname)}
        </span>
      )}
    </nav>
  );
}

interface PainelShellProps {
  children: ReactNode;
}

function ShellInner({ children }: PainelShellProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-mist">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-forest/10 bg-cream lg:flex lg:flex-col">
          <Sidebar />
        </aside>

        <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-soil/50 backdrop-blur-sm" />
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-cream shadow-2xl shadow-soil/25">
              <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
              <Dialog.Close className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-forest/10 bg-mist/60 text-moss transition-colors hover:border-forest/30 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream">
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Fechar menu</span>
              </Dialog.Close>
              <Sidebar onNavigate={() => setSheetOpen(false)} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="lg:pl-60">
          <header className="sticky top-0 z-30 border-b border-forest/10 bg-mist/85 backdrop-blur-sm">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-label="Abrir menu"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-forest/10 bg-cream text-forest transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist lg:hidden"
                >
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </button>
                <BreadcrumbNav pathname={pathname} />
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <form role="search" className="relative hidden lg:block">
                  <label htmlFor="global-search" className="sr-only">
                    Buscar
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss/50"
                    aria-hidden="true"
                  />
                  <input
                    id="global-search"
                    type="search"
                    placeholder="Buscar área, registro…"
                    className="h-9 w-56 rounded-full border border-forest/10 bg-cream pl-9 pr-3 text-sm text-forest placeholder:text-moss/40 transition-shadow duration-300 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15"
                  />
                </form>
                <RegistrationDialog />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
            {children}
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}

export function PainelShell({ children }: PainelShellProps) {
  return (
    <UserProvider>
      <ShellInner>{children}</ShellInner>
    </UserProvider>
  );
}
