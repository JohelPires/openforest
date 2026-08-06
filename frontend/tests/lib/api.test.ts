import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, login, logout, me } from "@/lib/api";
import { clearSession, setSession } from "@/lib/auth";

describe("api client", () => {
  beforeEach(() => {
    clearSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("faz login e retorna os tokens", async () => {
    const tokens = {
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(tokens), { status: 200 })),
    );

    await expect(
      login({ email: "voce@org.com", password: "senha123" }),
    ).resolves.toEqual(tokens);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "voce@org.com",
      password: "senha123",
    });
  });

  it("normaliza o erro de negócio do backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: [{ msg: "Email ou senha inválidos", type: "invalid_credentials" }],
          }),
          { status: 401 },
        ),
      ),
    );

    await expect(
      login({ email: "voce@org.com", password: "errada" }),
    ).rejects.toMatchObject({
      status: 401,
      type: "invalid_credentials",
      message: "Email ou senha inválidos",
    });
  });

  it("usa mensagem genérica quando o body não é JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("oops", { status: 500 })),
    );

    await expect(
      login({ email: "voce@org.com", password: "senha123" }),
    ).rejects.toMatchObject({
      status: 500,
      message: "Algo deu errado. Tente novamente.",
    });
  });

  it("em 401 tenta refresh e repete a requisição com o novo token", async () => {
    setSession(
      { access_token: "old-access", refresh_token: "old-refresh", token_type: "bearer" },
      true,
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: [{ msg: "Token expirado", type: "token_expired" }] }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            token_type: "bearer",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/projects/", { auth: true })).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCall = fetchMock.mock.calls[1];
    expect(refreshCall[0]).toBe("/api/v1/auth/refresh");

    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer new-access",
    );
  });

  it("não tenta refresh quando não há refresh token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ detail: [{ msg: "Token expirado", type: "token_expired" }] }),
          { status: 401 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/projects/", { auth: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("envia o header de autorização quando auth é true", async () => {
    setSession(
      { access_token: "abc", refresh_token: "def", token_type: "bearer" },
      true,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
    );

    await apiFetch("/projects/", { auth: true });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/projects/");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer abc",
    );
  });

  it("busca o usuário atual em /auth/me com autorização", async () => {
    setSession(
      { access_token: "abc", refresh_token: "def", token_type: "bearer" },
      true,
    );
    const user = {
      id: "user-1",
      name: "Ana Souza",
      email: "ana@folha-verde.org",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(user), { status: 200 })),
    );

    await expect(me()).resolves.toEqual(user);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/auth/me");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer abc",
    );
  });

  it("chama logout com o refresh token", async () => {    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ msg: "Logout realizado com sucesso" }), {
          status: 200,
        }),
      ),
    );

    await logout("refresh-token");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/auth/logout");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ refresh_token: "refresh-token" });
  });

  it("lança ApiError de conexão quando o fetch falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));

    await expect(apiFetch("/projects/", { auth: true })).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(apiFetch("/projects/", { auth: true })).rejects.toMatchObject({
      status: 0,
      message: "Não foi possível conectar ao servidor.",
    });
  });
});
