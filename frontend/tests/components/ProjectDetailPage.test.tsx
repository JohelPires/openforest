import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProjectDetailPage from "@/app/painel/projetos/[id]/page";
import type { MeOrganization, ProjectRead } from "@/lib/api";

const { apiFetchMock, updateProjectMock, deleteProjectMock, pushMock } =
  vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
    updateProjectMock: vi.fn(),
    deleteProjectMock: vi.fn(),
    pushMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: apiFetchMock,
    updateProject: updateProjectMock,
    deleteProject: deleteProjectMock,
  };
});

vi.mock("@/components/features/project-areas", () => ({
  ProjectAreas: () => null,
}));

let currentUser: {
  organization: MeOrganization | null;
  loading: boolean;
} = { organization: null, loading: false };

vi.mock("@/components/features/user-provider", () => ({
  useUser: () => currentUser,
}));

const project: ProjectRead = {
  id: "proj-1",
  organization_id: "org-1",
  name: "Corredor do Ribeirão",
  description: "Restauração da mata ciliar.",
  goal: "Reconectar o fragmento florestal.",
  start_date: "2024-05-01",
  responsible: "Carla Nunes",
  created_at: "2024-05-01T00:00:00Z",
  updated_at: "2024-05-01T00:00:00Z",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectDetailPage />
    </QueryClientProvider>,
  );
}

function managerUser(): void {
  currentUser = {
    organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
    loading: false,
  };
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    currentUser = { organization: null, loading: false };
    apiFetchMock.mockReset();
    updateProjectMock.mockReset();
    deleteProjectMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(cleanup);

  it("renderiza os detalhes do projeto", async () => {
    managerUser();
    apiFetchMock.mockResolvedValue(project);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Corredor do Ribeirão" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reconectar o fragmento florestal.")).toBeInTheDocument();
    expect(screen.getByText("Restauração da mata ciliar.")).toBeInTheDocument();
    expect(screen.getByText("Carla Nunes")).toBeInTheDocument();
  });

  it("mostra ações de editar e excluir para quem pode gerenciar", async () => {
    managerUser();
    apiFetchMock.mockResolvedValue(project);

    renderPage();

    await screen.findByRole("heading", { name: "Corredor do Ribeirão" });
    expect(
      screen.getByRole("button", { name: "Editar detalhes do projeto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir projeto" })).toBeInTheDocument();
  });

  it("esconde as ações para quem não pode gerenciar", async () => {
    currentUser = {
      organization: { id: "org-1", name: "Instituto Folha Verde", role: "viewer" },
      loading: false,
    };
    apiFetchMock.mockResolvedValue(project);

    renderPage();

    await screen.findByRole("heading", { name: "Corredor do Ribeirão" });
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
  });

  it("abre a edição pré-preenchida, salva e atualiza o título", async () => {
    managerUser();
    apiFetchMock.mockResolvedValue(project);
    updateProjectMock.mockResolvedValue({ ...project, name: "Corredor Norte" });
    const user = userEvent.setup();

    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Editar detalhes do projeto" }),
    );

    const nameInput = screen.getByLabelText("Nome do projeto");
    expect(nameInput).toHaveValue("Corredor do Ribeirão");
    expect(screen.getByLabelText("Responsável")).toHaveValue("Carla Nunes");

    await user.clear(nameInput);
    await user.type(nameInput, "Corredor Norte");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateProjectMock).toHaveBeenCalledWith(
        "proj-1",
        expect.objectContaining({ name: "Corredor Norte" }),
      );
    });
    expect(
      await screen.findByRole("heading", { name: "Corredor Norte" }),
    ).toBeInTheDocument();
  });

  it("mostra erro inline quando a edição falha", async () => {
    managerUser();
    apiFetchMock.mockResolvedValue(project);
    updateProjectMock.mockRejectedValue(new Error("Falha ao atualizar"));
    const user = userEvent.setup();

    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Editar detalhes do projeto" }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao atualizar");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("cancelar a exclusão fecha o diálogo sem chamar a API", async () => {
    managerUser();
    apiFetchMock.mockResolvedValue(project);
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Excluir projeto" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(/excluir o projeto/i);

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(deleteProjectMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("confirma a exclusão e volta para a lista de projetos", async () => {
    managerUser();
    apiFetchMock.mockResolvedValue(project);
    deleteProjectMock.mockResolvedValue({ msg: "Projeto excluído" });
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Excluir projeto" }));

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir projeto" }));

    await waitFor(() => {
      expect(deleteProjectMock).toHaveBeenCalledWith("proj-1");
    });
    expect(pushMock).toHaveBeenCalledWith("/painel/projetos");
  });
});
