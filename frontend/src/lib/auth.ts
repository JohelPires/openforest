import { clearCachedUser } from "@/lib/user";

const ACCESS_KEY = "openforest_access_token";
const REFRESH_KEY = "openforest_refresh_token";
const REMEMBER_KEY = "openforest_remember";
export const SESSION_COOKIE = "of_session";

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function storageFor(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

export function setSession(tokens: Token, remember: boolean): void {
  if (!canUseStorage()) return;

  const keep = storageFor(remember);
  const clear = storageFor(!remember);
  clear.removeItem(ACCESS_KEY);
  clear.removeItem(REFRESH_KEY);
  keep.setItem(ACCESS_KEY, tokens.access_token);
  keep.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  setSessionCookie(remember);
}

export function getSession(): Token | null {
  if (!canUseStorage()) return null;

  const access =
    localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(ACCESS_KEY);
  const refresh =
    localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  if (!access || !refresh) return null;

  return { access_token: access, refresh_token: refresh, token_type: "bearer" };
}

export function getAccessToken(): string | null {
  return getSession()?.access_token ?? null;
}

export function getRefreshToken(): string | null {
  return getSession()?.refresh_token ?? null;
}

export function isRemembered(): boolean {
  if (!canUseStorage()) return true;
  return localStorage.getItem(REMEMBER_KEY) !== "0";
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function clearSession(): void {
  if (canUseStorage()) {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    clearCachedUser();
  }
  clearSessionCookie();
}

function setSessionCookie(remember: boolean): void {
  if (!canUseStorage()) return;
  const maxAge = remember ? `; max-age=${SESSION_COOKIE_MAX_AGE}` : "";
  document.cookie = `${SESSION_COOKIE}=1; path=/; samesite=lax${maxAge}`;
}

export function clearSessionCookie(): void {
  if (!canUseStorage()) return;
  document.cookie = `${SESSION_COOKIE}=; path=/; samesite=lax; max-age=0`;
}
