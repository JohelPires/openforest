import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AreaDetailPage from "@/app/painel/projetos/[id]/areas/[areaId]/page";
import type { AreaRead, MonitoringRead, ProjectRead } from "@/lib/api";

const { getAreaMock, listAreaMonitoringsMock, apiFetchMock } = vi.hoisted(() => ({
  getAreaMock: vi.fn(),
  listAreaMonitoringsMock: vi.fn(),
  apiFetchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1", areaId: "area-1" }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getArea: getAreaMock,
    listAreaMonitorings: listAreaMonitoringsMock,
    apiFetch: apiFetchMock,
  };
});

const project: ProjectRead = {
  id: "proj-1",
  organization_id: "org-1",
  name: "Corredor do Ribeirão",
  description: null,
  goal: null,
  start_date: null,
  responsible: null,
  created_at: "2024-05-01T00:00:00Z",
  updated_at: "2024-05-01T00:00:00Z",
};

const area: AreaRead = {
  id: "area-1",
  project_id: "proj-1",
  name: "Borrazóis",
  goal: "Reconectar o fragmento florestal.",
  size_hectares: 42,
  biome: "Mata Atlântica",
  restoration_status: "active",
  recent_monitorings: [],
  created_at: "2024-05-01T00:00:00Z",
  updated_at: "2024-05-01T00:00:00Z",
};

const monitoring = (id: string, visitDate: string): MonitoringRead => ({
  id,
  area_id: "area-1",
  visit_date: visitDate,
  notes: `Visita ${id}`,
  seedling_count: 100,
  avg_height: 1,
  species_data: { Aroeira: {} },
  created_at: `${visitDate}T10:00:00Z`,
  updated_at: `${visitDate}T10:00:00Z`,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AreaDetailPage />
    </QueryClientProvider>,
  );
}

describe("AreaDetailPage", () => {
  beforeEach(() => {
    getAreaMock.mockReset();
    listAreaMonitoringsMock.mockReset();
    apiFetchMock.mockReset();
  });

  afterEach(cleanup);

  it("renderiza os detalhes da área e a primeira página de monitoramentos", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [monitoring("mon-1", "2024-06-01"), monitoring("mon-2", "2024-07-01")],
      total: 2,
      offset: 0,
      limit: 10,
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Borrazóis" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mata Atlântica")).toBeInTheDocument();
    expect(screen.getByText("42 ha")).toBeInTheDocument();
    expect(screen.getByText(/Reconectar o fragmento florestal/)).toBeInTheDocument();
    expect(await screen.findByText(/Visita mon-1/)).toBeInTheDocument();
    expect(screen.getByText(/Visita mon-2/)).toBeInTheDocument();
    expect(screen.getByText("2 visitas registradas")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Voltar para o projeto/ }),
    ).toHaveAttribute("href", "/painel/projetos/proj-1");
  });

  it("renderiza a pré-visualização da visão de satélite", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 10,
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Visão de satélite" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pré-visualização")).toBeInTheDocument();
    expect(
      screen.getByText(/Mata Atlântica · 42 ha/),
    ).toBeInTheDocument();
    expect(screen.getByText("coordenadas em breve")).toBeInTheDocument();
  });

  it("navega para a próxima página e busca com novo offset", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [monitoring("mon-1", "2024-06-01")],
      total: 12,
      offset: 0,
      limit: 10,
    });

    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Próxima/ }));

    expect(listAreaMonitoringsMock).toHaveBeenLastCalledWith("area-1", 10, 10);
    expect(await screen.findByText("Página 2 de 2")).toBeInTheDocument();
  });

  it("desabilita Anterior na primeira página e Próxima na última", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [monitoring("mon-1", "2024-06-01")],
      total: 12,
      offset: 0,
      limit: 10,
    });

    renderPage();

    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: /Anterior/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Próxima/ }));

    expect(await screen.findByRole("button", { name: /Próxima/ })).toBeDisabled();
  });

  it("mostra estado vazio quando não há monitoramentos", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 10,
    });

    renderPage();

    expect(
      await screen.findByText("Nenhuma visita registrada"),
    ).toBeInTheDocument();
  });

  it("mostra erro quando a área não carrega", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockRejectedValue(new Error("falha de rede"));
    listAreaMonitoringsMock.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 10 });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar a área/i,
    );
  });

  it("mostra erro na lista de monitoramentos com retry", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockRejectedValue(new Error("falha de rede"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar os monitoramentos/i,
    );
    expect(
      screen.getByRole("button", { name: /Tentar novamente/ }),
    ).toBeInTheDocument();
  });
});
