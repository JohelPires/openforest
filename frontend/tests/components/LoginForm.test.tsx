import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/login-form";
import { ApiError, type Token } from "@/lib/api";
import { clearSession } from "@/lib/auth";

const { pushMock, loginMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, login: loginMock };
});

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    pushMock.mockClear();
    loginMock.mockReset();
    clearSession();
  });

  it("faz validação local antes de chamar a API", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("E-mail"), "email-invalido");
    await user.type(screen.getByLabelText("Senha"), "senha123");
    await user.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe um e-mail válido para entrar.",
    );
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("mostra a mensagem de erro retornada pelo backend", async () => {
    loginMock.mockRejectedValue(
      new ApiError(401, "Email ou senha inválidos", "invalid_credentials"),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("E-mail"), "voce@org.com");
    await user.type(screen.getByLabelText("Senha"), "senha123");
    await user.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email ou senha inválidos",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redireciona para /painel após login bem-sucedido", async () => {
    loginMock.mockResolvedValue({
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
    } satisfies Token);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("E-mail"), "voce@org.com");
    await user.type(screen.getByLabelText("Senha"), "senha123");
    await user.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(pushMock).toHaveBeenCalledWith("/painel");
    expect(loginMock).toHaveBeenCalledWith({
      email: "voce@org.com",
      password: "senha123",
    });
  });

  it("desabilita o botão enquanto a requisição está pendente", async () => {
    let resolveLogin!: (tokens: Token) => void;
    loginMock.mockImplementation(
      () =>
        new Promise<Token>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("E-mail"), "voce@org.com");
    await user.type(screen.getByLabelText("Senha"), "senha123");
    await user.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(
      screen.getByRole("button", { name: "Entrando..." }),
    ).toBeDisabled();

    resolveLogin({
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/painel");
    });
  });
});
