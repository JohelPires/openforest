import { clearSession, getAccessToken, getRefreshToken, isRemembered, setSession } from '@/lib/auth'
import type { Token } from '@/lib/auth'
import type { PolygonGeometry } from '@/lib/geo'

export type { Token }

const BASE_PATH = '/api/v1'

export class ApiError extends Error {
   status: number
   type?: string

   constructor(status: number, message: string, type?: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.type = type
   }
}

interface ApiFetchOptions {
   method?: string
   body?: unknown
   auth?: boolean
   retry?: boolean
   responseType?: 'json' | 'blob'
}

async function parseError(response: Response): Promise<ApiError> {
   let message = 'Algo deu errado. Tente novamente.'
   let type: string | undefined

   try {
      const data: unknown = await response.json()
      const detail = Array.isArray(data) ? data[0] : (data as Record<string, unknown>)?.detail
      if (Array.isArray(detail) && detail.length > 0) {
         const first = detail[0] as Record<string, unknown>
         if (typeof first.msg === 'string') message = first.msg
         if (typeof first.type === 'string') type = first.type
      } else if (typeof detail === 'string') {
         message = detail
      }
   } catch {
      // keep the generic message when the body is not JSON
   }

   return new ApiError(response.status, message, type)
}

async function refreshTokens(): Promise<boolean> {
   const refreshToken = getRefreshToken()
   if (!refreshToken) return false

   try {
      const tokens = await apiFetch<Token>('/auth/refresh', {
         method: 'POST',
         body: { refresh_token: refreshToken },
         retry: false,
      })
      setSession(tokens, isRemembered())
      return true
   } catch {
      clearSession()
      return false
   }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
   const { method = 'GET', body, auth = false, retry = true, responseType = 'json' } = options

   const headers: Record<string, string> = {}
   if (body !== undefined) headers['Content-Type'] = 'application/json'

   const accessToken = getAccessToken()
   if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`

   let response: Response
   try {
      response = await fetch(`${BASE_PATH}${path}`, {
         method,
         headers,
         body: body !== undefined ? JSON.stringify(body) : undefined,
      })
   } catch {
      throw new ApiError(0, 'Não foi possível conectar ao servidor.')
   }

   if (!response.ok) {
      const error = await parseError(response)

      if (retry && auth && error.status === 401 && getRefreshToken()) {
         if (await refreshTokens()) {
            return apiFetch<T>(path, { ...options, retry: false })
         }
      }

      throw error
   }

   if (response.status === 204) return undefined as T
   if (responseType === 'blob') return (await response.blob()) as unknown as T
   return (await response.json()) as T
}

export interface LoginCredentials {
   email: string
   password: string
}

export interface RegisterInput {
   name: string
   email: string
   password: string
}

export function login(credentials: LoginCredentials): Promise<Token> {
   return apiFetch<Token>('/auth/login', {
      method: 'POST',
      body: credentials,
   })
}

export function register(input: RegisterInput): Promise<Token> {
   return apiFetch<Token>('/auth/register', {
      method: 'POST',
      body: input,
   })
}

export function logout(refreshToken: string): Promise<{ msg?: string }> {
   return apiFetch<{ msg?: string }>('/auth/logout', {
      method: 'POST',
      body: { refresh_token: refreshToken },
   })
}

export type UserRole = 'admin' | 'manager' | 'researcher' | 'volunteer' | 'viewer'

export interface MeOrganization {
   id: string
   name: string
   role: UserRole
}

export interface MeRead {
   id: string
   name: string
   email: string
   created_at: string
   updated_at: string
   organization: MeOrganization | null
}

export function me(): Promise<MeRead> {
   return apiFetch<MeRead>('/auth/me', { auth: true })
}

export interface ProjectCreate {
   organization_id: string
   name: string
   description?: string | null
   goal?: string | null
   start_date?: string | null
   responsible?: string | null
}

export interface ProjectRead extends ProjectCreate {
   id: string
   created_at: string
   updated_at: string
}

export interface Paginated<T> {
   items: T[]
   total: number
   offset: number
   limit: number
}

export function listProjects(organizationId?: string): Promise<Paginated<ProjectRead>> {
   const query = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : ''
   return apiFetch<Paginated<ProjectRead>>(`/projects/${query}`, { auth: true })
}

export function createProject(input: ProjectCreate): Promise<ProjectRead> {
  return apiFetch<ProjectRead>("/projects/", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export interface ProjectUpdate {
  name?: string | null;
  description?: string | null;
  goal?: string | null;
  start_date?: string | null;
  responsible?: string | null;
}

export function updateProject(
  projectId: string,
  input: ProjectUpdate,
): Promise<ProjectRead> {
  return apiFetch<ProjectRead>(`/projects/${projectId}`, {
    method: "PATCH",
    body: input,
    auth: true,
  });
}

export function deleteProject(
  projectId: string,
): Promise<{ msg?: string }> {
  return apiFetch<{ msg?: string }>(`/projects/${projectId}`, {
    method: "DELETE",
    auth: true,
  });
}

export type RestorationStatus =
  | "planned"
  | "active"
  | "completed"
  | "cancelled";

export interface MonitoringRead {
  id: string;
  area_id: string;
  visit_date: string;
  notes?: string | null;
  seedling_count?: number | null;
  avg_height?: number | null;
  species_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoRead {
  id: string;
  monitoring_id: string;
  file_path: string;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AreaRead {
  id: string;
  project_id: string;
  name: string;
  goal?: string | null;
  size_hectares?: number | null;
  biome?: string | null;
  coordinates?: PolygonGeometry | null;
  restoration_status: RestorationStatus;
  recent_monitorings?: MonitoringRead[];
  created_at: string;
  updated_at: string;
}

export interface AreaCreate {
  name: string;
  goal?: string | null;
  size_hectares?: number | null;
  biome?: string | null;
  coordinates?: PolygonGeometry | null;
  restoration_status?: RestorationStatus;
}

export function projectAreas(
  projectId: string,
  offset = 0,
  limit = 100,
): Promise<Paginated<AreaRead>> {
  return apiFetch<Paginated<AreaRead>>(
    `/projects/${projectId}/areas?offset=${offset}&limit=${limit}`,
    { auth: true },
  );
}

export function createArea(
  projectId: string,
  input: AreaCreate,
): Promise<AreaRead> {
  return apiFetch<AreaRead>(`/projects/${projectId}/areas`, {
    method: "POST",
    body: input,
    auth: true,
  });
}

export function getArea(areaId: string): Promise<AreaRead> {
  return apiFetch<AreaRead>(`/areas/${areaId}`, { auth: true });
}

export function listAreaMonitorings(
  areaId: string,
  offset: number,
  limit: number,
): Promise<Paginated<MonitoringRead>> {
  return apiFetch<Paginated<MonitoringRead>>(
    `/areas/${areaId}/monitorings?offset=${offset}&limit=${limit}`,
    { auth: true },
  );
}

export function listMonitoringPhotos(
  monitoringId: string,
  offset = 0,
  limit = 100,
): Promise<Paginated<PhotoRead>> {
  return apiFetch<Paginated<PhotoRead>>(
    `/monitorings/${monitoringId}/photos?offset=${offset}&limit=${limit}`,
    { auth: true },
  );
}

export function downloadPhoto(photoId: string): Promise<Blob> {
  return apiFetch<Blob>(`/photos/${photoId}/download`, {
    auth: true,
    responseType: "blob",
  });
}
