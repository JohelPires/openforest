import type { MeRead, UserRole } from "@/lib/api";

const USER_KEY = "openforest_user";

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  researcher: "Pesquisador",
  volunteer: "Voluntário",
  viewer: "Visualizador",
};

export function getCachedUser(): MeRead | null {
  if (typeof window === "undefined") return null;

  const raw =
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MeRead;
  } catch {
    return null;
  }
}

export function setCachedUser(user: MeRead): void {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(user);
  const remember = localStorage.getItem("openforest_remember") !== "0";
  (remember ? localStorage : sessionStorage).setItem(USER_KEY, raw);
}

export function clearCachedUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}
