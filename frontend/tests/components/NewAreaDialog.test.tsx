import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NewAreaDialog,
  type NewAreaInput,
} from "@/components/features/new-area-dialog";

function renderDialog(
  onCreate: (input: NewAreaInput) => Promise<void> = vi.fn(async () => {}),
) {
  return render(<NewAreaDialog onCreate={onCreate} />);
}

describe("NewAreaDialog", () => {
  afterEach(cleanup);

  it("abre o formulário com os campos de área", async () => {
    renderDialog();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Cadastrar primeira área" }),
    );

    expect(
      screen.getByRole("heading", { name: "Nova área" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da área")).toBeInTheDocument();
    expect(screen.getByLabelText("Objetivo")).toBeInTheDocument();
    expect(screen.getByLabelText("Bioma")).toBeInTheDocument();
    expect(screen.getByLabelText("Tamanho (ha)")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("planned");
  });

  it("pede um nome quando o formulário é enviado vazio", async () => {
    const onCreate = vi.fn(async () => {});
    renderDialog(onCreate);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Cadastrar primeira área" }),
    );
    await user.click(screen.getByRole("button", { name: "Criar área" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Dê um nome à área.");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("cria a área e envia os dados preenchidos", async () => {
    const onCreate = vi.fn(async () => {});
    renderDialog(onCreate);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Cadastrar primeira área" }),
    );
    await user.type(
      screen.getByLabelText("Nome da área"),
      "Mata ciliar do ribeirão",
    );
    await user.type(
      screen.getByLabelText("Objetivo"),
      "Reconectar a mata ciliar.",
    );
    await user.selectOptions(screen.getByLabelText("Bioma"), "Mata Atlântica");
    await user.type(screen.getByLabelText("Tamanho (ha)"), "12.5");
    await user.selectOptions(screen.getByLabelText("Status"), "active");
    await user.click(screen.getByRole("button", { name: "Criar área" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: "Mata ciliar do ribeirão",
        goal: "Reconectar a mata ciliar.",
        biome: "Mata Atlântica",
        size_hectares: 12.5,
        restoration_status: "active",
      });
    });
  });

  it("envia status Planejada por padrão", async () => {
    const onCreate = vi.fn(async () => {});
    renderDialog(onCreate);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Cadastrar primeira área" }),
    );
    await user.type(screen.getByLabelText("Nome da área"), "Talhão 3");
    await user.click(screen.getByRole("button", { name: "Criar área" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ restoration_status: "planned" }),
      );
    });
  });

  it("mostra erro inline quando a criação falha", async () => {
    const onCreate = vi.fn(async () => {
      throw new Error("Falha ao criar a área");
    });
    renderDialog(onCreate);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Cadastrar primeira área" }),
    );
    await user.type(screen.getByLabelText("Nome da área"), "Talhão 3");
    await user.click(screen.getByRole("button", { name: "Criar área" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao criar a área",
    );
    expect(
      screen.getByRole("button", { name: "Criar área" }),
    ).toBeInTheDocument();
  });
});
