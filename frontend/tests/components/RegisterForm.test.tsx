import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "@/components/register-form";
import { ApiError, type Token } from "@/lib/api";
import { clearSession } from "@/lib/auth";

const { pushMock, registerMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, register: registerMock };
});

describe("RegisterForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    pushMock.mockClear();
    registerMock.mockReset();
    clearSession();
  });

  async function preencherFormulario(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Nome completo"), "Maria Silva");
    await user.type(screen.getByLabelText("E-mail"), "maria@org.com");
    await user.type(screen.getByLabelText("Senha"), "senha12345");
    await user.type(screen.getByLabelText("Confirmar senha"), "senha12345");
    await user.click(screen.getByRole("checkbox", { name: /Li e aceito os termos/ }));
  }

  it("valida que as senhas conferem", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await preencherFormulario(user);
    await user.clear(screen.getByLabelText("Confirmar senha"));
    await user.type(screen.getByLabelText("Confirmar senha"), "outra-senha");
    await user.click(screen.getByRole("button", { name: "Criar conta gratuita" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "As senhas não conferem.",
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("mostra erro de e-mail duplicado retornado pelo backend", async () => {
    registerMock.mockRejectedValue(
      new ApiError(409, "Email já cadastrado", "duplicate_email"),
    );
    const user = userEvent.setup();
    render(<RegisterForm />);

    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: "Criar conta gratuita" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email já cadastrado",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redireciona para /painel após registrar (auto-login)", async () => {
    registerMock.mockResolvedValue({
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
    } satisfies Token);
    const user = userEvent.setup();
    render(<RegisterForm />);

    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: "Criar conta gratuita" }));

    expect(pushMock).toHaveBeenCalledWith("/painel");
    expect(registerMock).toHaveBeenCalledWith({
      name: "Maria Silva",
      email: "maria@org.com",
      password: "senha12345",
    });
  });

  it("desabilita o botão enquanto a requisição está pendente", async () => {
    let resolveRegister!: (tokens: Token) => void;
    registerMock.mockImplementation(
      () =>
        new Promise<Token>((resolve) => {
          resolveRegister = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<RegisterForm />);

    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: "Criar conta gratuita" }));

    expect(
      screen.getByRole("button", { name: "Criando conta..." }),
    ).toBeDisabled();

    resolveRegister({
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/painel");
    });
  });
});
