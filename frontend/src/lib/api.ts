import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  isRemembered,
  setSession,
} from "@/lib/auth";
import type { Token } from "@/lib/auth";

export type { Token };

const BASE_PATH = "/api/v1";

export class ApiError extends Error {
  status: number;
  type?: string;

  constructor(status: number, message: string, type?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.type = type;
  }
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  let message = "Algo deu errado. Tente novamente.";
  let type: string | undefined;

  try {
    const data: unknown = await response.json();
    const detail = Array.isArray(data) ? data[0] : (data as Record<string, unknown>)?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as Record<string, unknown>;
      if (typeof first.msg === "string") message = first.msg;
      if (typeof first.type === "string") type = first.type;
    } else if (typeof detail === "string") {
      message = detail;
    }
  } catch {
    // keep the generic message when the body is not JSON
  }

  return new ApiError(response.status, message, type);
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const tokens = await apiFetch<Token>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
      retry: false,
    });
    setSession(tokens, isRemembered());
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = false, retry = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const accessToken = getAccessToken();
  if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_PATH}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }

  if (!response.ok) {
    const error = await parseError(response);

    if (
      retry &&
      auth &&
      error.status === 401 &&
      getRefreshToken()
    ) {
      if (await refreshTokens()) {
        return apiFetch<T>(path, { ...options, retry: false });
      }
    }

    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export function login(credentials: LoginCredentials): Promise<Token> {
  return apiFetch<Token>("/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export function register(input: RegisterInput): Promise<Token> {
  return apiFetch<Token>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function logout(refreshToken: string): Promise<{ msg?: string }> {
  return apiFetch<{ msg?: string }>("/auth/logout", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export type UserRole =
  | "admin"
  | "manager"
  | "researcher"
  | "volunteer"
  | "viewer";

export interface MeOrganization {
  id: string;
  name: string;
  role: UserRole;
}

export interface MeRead {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  organization: MeOrganization | null;
}

export function me(): Promise<MeRead> {
  return apiFetch<MeRead>("/auth/me", { auth: true });
}

export interface ProjectCreate {
  organization_id: string;
  name: string;
  description?: string | null;
  goal?: string | null;
  start_date?: string | null;
  responsible?: string | null;
}

export interface ProjectRead extends ProjectCreate {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export function listProjects(
  organizationId?: string,
): Promise<Paginated<ProjectRead>> {
  const query = organizationId
    ? `?organization_id=${encodeURIComponent(organizationId)}`
    : "";
  return apiFetch<Paginated<ProjectRead>>(`/projects/${query}`, { auth: true });
}

export function createProject(input: ProjectCreate): Promise<ProjectRead> {
  return apiFetch<ProjectRead>("/projects/", {
    method: "POST",
    body: input,
    auth: true,
  });
}
