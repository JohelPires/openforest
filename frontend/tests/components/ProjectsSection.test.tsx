import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectsSection } from "@/components/features/projects-section";
import type {
  MeOrganization,
  ProjectRead,
} from "@/lib/api";

const { listProjectsMock, createProjectMock } = vi.hoisted(() => ({
  listProjectsMock: vi.fn(),
  createProjectMock: vi.fn(),
}));

let currentUser: {
  organization: MeOrganization | null;
  loading: boolean;
} = { organization: null, loading: false };

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listProjects: listProjectsMock,
    createProject: createProjectMock,
  };
});

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

function renderSection() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectsSection />
    </QueryClientProvider>,
  );
}

describe("ProjectsSection", () => {
  beforeEach(() => {
    currentUser = { organization: null, loading: false };
    listProjectsMock.mockReset();
    createProjectMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("mostra skeletons enquanto a lista de projetos carrega", () => {
    currentUser = {
      organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
      loading: false,
    };
    listProjectsMock.mockReturnValue(new Promise(() => {}));

    renderSection();

    expect(
      screen.getByRole("status", { name: "Carregando projetos" }),
    ).toBeInTheDocument();
  });

  it("mostra skeletons enquanto o usuário está carregando", () => {
    currentUser = { organization: null, loading: true };

    renderSection();

    expect(
      screen.getByRole("status", { name: "Carregando projetos" }),
    ).toBeInTheDocument();
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it("renderiza os projetos da organização com link para o detalhe", async () => {
    currentUser = {
      organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
      loading: false,
    };
    listProjectsMock.mockResolvedValue({
      items: [project],
      total: 1,
      offset: 0,
      limit: 20,
    });

    renderSection();

    const card = await screen.findByRole("link", {
      name: /Corredor do Ribeirão/,
    });
    expect(card).toHaveAttribute("href", "/painel/projetos/proj-1");
    expect(listProjectsMock).toHaveBeenCalledWith("org-1");
  });

  it("esconde o card de novo projeto para quem não pode criar", async () => {
    currentUser = {
      organization: { id: "org-1", name: "Instituto Folha Verde", role: "viewer" },
      loading: false,
    };
    listProjectsMock.mockResolvedValue({
      items: [project],
      total: 1,
      offset: 0,
      limit: 20,
    });

    renderSection();

    await screen.findByRole("link", { name: /Corredor do Ribeirão/ });
    expect(
      screen.queryByRole("button", { name: "Criar novo projeto" }),
    ).not.toBeInTheDocument();
  });

  it("abre o diálogo e cria um projeto na organização atual", async () => {
    currentUser = {
      organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
      loading: false,
    };
    const created = { ...project, id: "proj-2", name: "Nova área" };
    listProjectsMock
      .mockResolvedValueOnce({ items: [], total: 0, offset: 0, limit: 20 })
      .mockResolvedValueOnce({
        items: [created],
        total: 1,
        offset: 0,
        limit: 20,
      });
    createProjectMock.mockResolvedValue(created);
    const user = userEvent.setup();

    renderSection();

    await screen.findByRole("button", { name: "Criar novo projeto" });
    await user.click(screen.getByRole("button", { name: "Criar novo projeto" }));

    await user.type(screen.getByLabelText("Nome do projeto"), "Nova área");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));

    await waitFor(() => {
      expect(createProjectMock.mock.calls[0][0]).toMatchObject({
        organization_id: "org-1",
        name: "Nova área",
      });
    });
    expect(listProjectsMock).toHaveBeenCalledTimes(2);
  });

  it("mostra o erro e permite tentar novamente", async () => {
    currentUser = {
      organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
      loading: false,
    };
    listProjectsMock
      .mockRejectedValueOnce(new Error("falha de rede"))
      .mockResolvedValueOnce({
        items: [project],
        total: 1,
        offset: 0,
        limit: 20,
      });
    const user = userEvent.setup();

    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar os projetos/i,
    );

    await user.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );

    expect(
      await screen.findByRole("link", { name: /Corredor do Ribeirão/ }),
    ).toBeInTheDocument();
  });
});
