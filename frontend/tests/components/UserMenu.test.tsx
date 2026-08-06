import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserMenu } from "@/components/features/user-menu";
import { UserProvider } from "@/components/features/user-provider";
import { ApiError, type MeRead } from "@/lib/api";
import { clearSession, setSession } from "@/lib/auth";

const { replaceMock, meMock, logoutMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  meMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: replaceMock }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, me: meMock, logout: logoutMock };
});

const USER: MeRead = {
  id: "user-1",
  name: "Ana Souza",
  email: "ana@folha-verde.org",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
};

function renderMenu() {
  return render(
    <UserProvider>
      <UserMenu />
    </UserProvider>,
  );
}

describe("UserMenu", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    replaceMock.mockClear();
    meMock.mockReset();
    logoutMock.mockReset();
    clearSession();
  });

  it("mostra as iniciais e o primeiro nome após carregar o usuário", async () => {
    meMock.mockResolvedValue(USER);

    renderMenu();

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("mostra nome completo, e-mail e ações ao abrir o menu", async () => {
    meMock.mockResolvedValue(USER);
    const user = userEvent.setup();

    renderMenu();

    await user.click(
      await screen.findByRole("button", { name: "Menu do usuário: Ana Souza" }),
    );

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("ana@folha-verde.org")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Configurações/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Sair da conta/ }),
    ).toBeInTheDocument();
  });

  it("chama logout e redireciona para /auth/login ao sair", async () => {
    meMock.mockResolvedValue(USER);
    logoutMock.mockResolvedValue({ msg: "ok" });
    setSession(
      { access_token: "abc", refresh_token: "refresh-token", token_type: "bearer" },
      true,
    );
    const user = userEvent.setup();

    renderMenu();

    await user.click(
      await screen.findByRole("button", { name: "Menu do usuário: Ana Souza" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Sair da conta/ }),
    );

    expect(logoutMock).toHaveBeenCalledWith("refresh-token");
    await vi.waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("redireciona para /auth/login quando /auth/me responde 401", async () => {
    meMock.mockRejectedValue(new ApiError(401, "Token expirado", "token_expired"));

    renderMenu();

    await vi.waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/auth/login");
    });
  });
});
