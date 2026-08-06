"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut, Settings } from "lucide-react";
import { Avatar } from "@base-ui/react/avatar";
import { Menu } from "@base-ui/react/menu";
import { useUser } from "@/components/features/user-provider";
import { logout } from "@/lib/api";
import { clearSession, getRefreshToken } from "@/lib/auth";
import { initialsOf } from "@/lib/user";
import { cn } from "@/lib/utils";

const triggerClasses =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-forest/10 bg-cream py-1 pl-1 pr-3 transition-colors hover:border-forest/25 hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist";

const itemClasses =
  "flex w-full cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-forest transition-colors data-highlighted:bg-forest/8 focus-visible:outline-none";

const popupClasses =
  "relative z-50 min-w-56 origin-[var(--transform-origin)] rounded-xl border border-forest/10 bg-cream p-1.5 shadow-xl shadow-soil/15 outline-none transition-[scale,opacity] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0";

export function UserMenu() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [pending, setPending] = useState(false);

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

  if (loading) {
    return (
      <span
        aria-hidden="true"
        className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-forest/10"
      />
    );
  }

  const initials = user ? initialsOf(user.name) : "?";

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={
          user ? `Menu do usuário: ${user.name}` : "Abrir menu do usuário"
        }
        className={triggerClasses}
      >
        <Avatar.Root className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest font-mono text-[10px] font-medium text-cream">
          <Avatar.Fallback>{initials}</Avatar.Fallback>
        </Avatar.Root>
        {user ? (
          <span className="hidden max-w-32 truncate text-sm font-medium text-forest lg:inline">
            {user.name.split(/\s+/)[0]}
          </span>
        ) : null}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-50 outline-none">
          <Menu.Popup className={popupClasses}>
            {user ? (
              <div className="border-b border-forest/10 px-3 py-2.5">
                <p className="truncate text-sm font-medium text-forest">
                  {user.name}
                </p>
                <p className="truncate font-mono text-[11px] text-moss/70">
                  {user.email}
                </p>
              </div>
            ) : null}

            <div className="pt-1.5">
              <Menu.Item
                className={itemClasses}
                onClick={() => router.push("/painel/configuracoes")}
              >
                <Settings className="h-4 w-4 text-moss/70" aria-hidden="true" />
                Configurações
              </Menu.Item>

              <Menu.Separator className="mx-1 my-1 h-px bg-forest/10" />

              <Menu.Item
                className={cn(itemClasses, "text-destructive", "data-highlighted:bg-destructive/10")}
                onClick={handleLogout}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                )}
                Sair da conta
              </Menu.Item>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
