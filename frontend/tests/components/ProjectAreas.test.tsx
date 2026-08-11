import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectAreas } from "@/components/features/project-areas";
import type { AreaRead } from "@/lib/api";

const { projectAreasMock, createAreaMock } = vi.hoisted(() => ({
  projectAreasMock: vi.fn(),
  createAreaMock: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    projectAreas: projectAreasMock,
    createArea: createAreaMock,
  };
});

vi.mock("@/components/reveal", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const areas: AreaRead[] = [
  {
    id: "area-1",
    project_id: "proj-restauracao-norte",
    name: "Borrazóis",
    biome: "Mata Atlântica",
    size_hectares: 42,
    restoration_status: "active",
    recent_monitorings: [
      {
        id: "mon-2",
        area_id: "area-1",
        visit_date: "2020-09-15",
        notes: "Sobrevivência acima do esperado.",
        seedling_count: 920,
        avg_height: 1.1,
        species_data: { Aroeira: {} },
        created_at: "2020-09-15T10:00:00Z",
        updated_at: "2020-09-15T10:00:00Z",
      },
      {
        id: "mon-1",
        area_id: "area-1",
        visit_date: "2019-06-20",
        notes: "Plantio de 980 mudas concluído.",
        seedling_count: 980,
        avg_height: 0.4,
        species_data: { Aroeira: {}, Angico: {} },
        created_at: "2019-06-20T10:00:00Z",
        updated_at: "2019-06-20T10:00:00Z",
      },
    ],
    created_at: "2019-04-12T00:00:00Z",
    updated_at: "2019-04-12T00:00:00Z",
  },
];

function renderSection(canCreate = false) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectAreas projectId="proj-restauracao-norte" canCreate={canCreate} />
    </QueryClientProvider>,
  );
}

describe("ProjectAreas", () => {
  beforeEach(() => {
    projectAreasMock.mockReset();
    createAreaMock.mockReset();
  });

  afterEach(cleanup);

  it("renderiza a régua com as áreas do projeto", async () => {
    projectAreasMock.mockResolvedValue({
      items: areas,
      total: areas.length,
      offset: 0,
      limit: 100,
    });

    renderSection();

    expect(
      await screen.findByRole("heading", { name: "Áreas do projeto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Borrazóis" }),
    ).toBeInTheDocument();
    expect(projectAreasMock).toHaveBeenCalledWith("proj-restauracao-norte");
  });

  it("mostra convite vazio para projeto sem áreas", async () => {
    projectAreasMock.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 100 });

    renderSection();

    expect(
      await screen.findByText("As áreas deste projeto aparecem aqui"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Áreas do projeto" }),
    ).not.toBeInTheDocument();
  });

  it("lista os monitoramentos recentes da área na timeline", async () => {
    projectAreasMock.mockResolvedValue({
      items: areas,
      total: areas.length,
      offset: 0,
      limit: 100,
    });

    renderSection();

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /2 visitas registradas/ }),
    );
    expect(
      screen.getByText(/Plantio de 980 mudas concluído/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sobrevivência acima do esperado/i),
    ).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    projectAreasMock.mockRejectedValue(new Error("falha de rede"));

    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar as áreas/i,
    );
  });

  it("cadastra a primeira área a partir do estado vazio", async () => {
    projectAreasMock
      .mockResolvedValueOnce({ items: [], total: 0, offset: 0, limit: 100 })
      .mockResolvedValueOnce({
        items: areas,
        total: areas.length,
        offset: 0,
        limit: 100,
      });
    createAreaMock.mockResolvedValue(areas[0]);
    const user = userEvent.setup();

    renderSection(true);

    await screen.findByText("As áreas deste projeto aparecem aqui");
    await user.click(
      screen.getByRole("button", { name: "Cadastrar primeira área" }),
    );
    await user.type(screen.getByLabelText("Nome da área"), "Borrazóis");
    await user.click(screen.getByRole("button", { name: "Criar área" }));

    await waitFor(() => {
      expect(createAreaMock).toHaveBeenCalledWith(
        "proj-restauracao-norte",
        expect.objectContaining({ name: "Borrazóis" }),
      );
    });
    expect(
      await screen.findByRole("heading", { name: "Áreas do projeto" }),
    ).toBeInTheDocument();
  });

  it("oferece criar área na régua quando o usuário pode gerenciar", async () => {
    projectAreasMock.mockResolvedValue({
      items: areas,
      total: areas.length,
      offset: 0,
      limit: 100,
    });

    renderSection(true);

    expect(
      await screen.findByRole("button", { name: "Criar nova área" }),
    ).toBeInTheDocument();
  });

  it("esconde a ação de criar área para quem não pode gerenciar", async () => {
    projectAreasMock.mockResolvedValue({
      items: areas,
      total: areas.length,
      offset: 0,
      limit: 100,
    });

    renderSection();

    await screen.findByRole("heading", { name: "Áreas do projeto" });
    expect(
      screen.queryByRole("button", { name: "Criar nova área" }),
    ).not.toBeInTheDocument();
  });
});
