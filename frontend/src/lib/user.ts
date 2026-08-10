import type { MeRead, UserRole } from "@/lib/api";

const USER_KEY = "openforest_user";

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  researcher: "Pesquisador",
  volunteer: "Voluntário",
  viewer: "Visualizador",
};

export const MANAGE_ROLES: UserRole[] = ["admin", "manager"];

export function canManageOrganization(role: UserRole | null | undefined): boolean {
  return role != null && MANAGE_ROLES.includes(role);
}

type Listener = () => void;

const listeners = new Set<Listener>();

let cachedUser: MeRead | null = null;
let cacheRead = false;

function readCache(): MeRead | null {
  const raw =
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MeRead;
  } catch {
    return null;
  }
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

export function getCachedUser(): MeRead | null {
  if (typeof window === "undefined") return null;

  if (!cacheRead) {
    cachedUser = readCache();
    cacheRead = true;
  }
  return cachedUser;
}

export function subscribeUserCache(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCachedUser(user: MeRead): void {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(user);
  const remember = localStorage.getItem("openforest_remember") !== "0";
  (remember ? localStorage : sessionStorage).setItem(USER_KEY, raw);

  cachedUser = user;
  cacheRead = true;
  emitChange();
}

export function clearCachedUser(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);

  cachedUser = null;
  cacheRead = true;
  emitChange();
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
