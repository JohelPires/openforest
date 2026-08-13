import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitoringDetailDialog } from "@/components/features/monitoring-detail-dialog";
import type { MonitoringListItem } from "@/components/features/monitoring-list";
import type { PhotoRead } from "@/lib/api";

const { listMonitoringPhotosMock } = vi.hoisted(() => ({
  listMonitoringPhotosMock: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, listMonitoringPhotos: listMonitoringPhotosMock };
});

vi.mock("@/components/features/monitoring-photo", () => ({
  MonitoringPhoto: ({ photo }: { photo: PhotoRead }) => (
    <div data-testid="monitoring-photo">{photo.original_filename}</div>
  ),
}));

const monitoring: MonitoringListItem = {
  id: "mon-1",
  area_id: "area-1",
  visit_date: "2024-06-01",
  notes: "Plantio concluído no quadrante 1.",
  seedling_count: 980,
  avg_height: 0.4,
  species_data: { Aroeira: {}, Angico: {} },
  created_at: "2024-06-01T10:00:00Z",
  updated_at: "2024-06-01T10:00:00Z",
};

const photo = (id: string): PhotoRead => ({
  id,
  monitoring_id: "mon-1",
  file_path: `/uploads/mon-1/${id}.jpg`,
  original_filename: `${id}.jpg`,
  created_at: "2024-06-01T10:00:00Z",
  updated_at: "2024-06-01T10:00:00Z",
});

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MonitoringDetailDialog
        monitoring={monitoring}
        areaName="Borrazóis"
        open
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("MonitoringDetailDialog", () => {
  beforeEach(() => {
    listMonitoringPhotosMock.mockReset();
  });

  afterEach(cleanup);

  it("renderiza notas, métricas e espécies do monitoramento", async () => {
    listMonitoringPhotosMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 100,
    });

    renderDialog();

    expect(await screen.findByText("980 mudas")).toBeInTheDocument();
    expect(screen.getByText("0,4 m médios")).toBeInTheDocument();
    expect(screen.getByText("Aroeira")).toBeInTheDocument();
    expect(screen.getByText("Angico")).toBeInTheDocument();
    expect(screen.getByText(/Plantio concluído no quadrante 1/i)).toBeInTheDocument();
    expect(screen.getByText("Área · Borrazóis")).toBeInTheDocument();
  });

  it("renderiza as fotos da visita em grade", async () => {
    listMonitoringPhotosMock.mockResolvedValue({
      items: [photo("p1"), photo("p2")],
      total: 2,
      offset: 0,
      limit: 100,
    });

    renderDialog();

    const thumbs = await screen.findAllByTestId("monitoring-photo");
    expect(thumbs).toHaveLength(2);
    expect(listMonitoringPhotosMock).toHaveBeenCalledWith("mon-1", 0, 100);
  });

  it("mostra o estado vazio quando não há fotos", async () => {
    listMonitoringPhotosMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 100,
    });

    renderDialog();

    expect(
      await screen.findByText("Nenhuma foto anexada a esta visita."),
    ).toBeInTheDocument();
  });

  it("mostra erro nas fotos e permite tentar novamente", async () => {
    listMonitoringPhotosMock
      .mockRejectedValueOnce(new Error("falha de rede"))
      .mockResolvedValueOnce({
        items: [photo("p1")],
        total: 1,
        offset: 0,
        limit: 100,
      });

    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar as fotos/i,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Tentar novamente/ }));

    expect(await screen.findByTestId("monitoring-photo")).toBeInTheDocument();
  });
});
