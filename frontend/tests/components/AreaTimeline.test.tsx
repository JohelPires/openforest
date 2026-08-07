import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AreaTimeline } from "@/components/features/area-timeline";
import type { Area } from "@/lib/mock-data";

vi.mock("@/components/reveal", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const areas: Area[] = [
  {
    id: "area-a",
    project_id: "proj-restauracao-norte",
    name: "Borrazóis",
    biome: "Mata Atlântica",
    size_hectares: 42,
    restoration_status: "active",
    started_at: "2019-04-12",
    goal: "Reconectar o fragmento florestal.",
    seedlings: 3180,
    survival_rate: 91,
    monitorings: [
      {
        id: "mon-1",
        visit_date: "2019-06-20",
        author: "Carla Nunes",
        notes: "Plantio de 980 mudas concluído.",
        seedling_count: 980,
        avg_height: 0.4,
        species_data: { Aroeira: {}, Angico: {} },
        photos: [],
      },
    ],
  },
  {
    id: "area-b",
    project_id: "proj-restauracao-norte",
    name: "Serra Verde",
    biome: "Cerrado",
    size_hectares: 18,
    restoration_status: "planned",
    started_at: "2025-01-15",
    goal: "Recuperar a encosta.",
    seedlings: 920,
    survival_rate: 84,
    monitorings: [],
  },
];

describe("AreaTimeline", () => {
  afterEach(cleanup);

  it("renderiza uma faixa por área com o título", () => {
    render(<AreaTimeline areas={areas} />);
    expect(screen.getByRole("heading", { name: "Borrazóis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Serra Verde" })).toBeInTheDocument();
    expect(screen.getByText("Suas áreas, ao longo do tempo")).toBeInTheDocument();
  });

  it("renderiza null quando não há áreas", () => {
    const { container } = render(<AreaTimeline areas={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("expande a lista de visitas da área", async () => {
    const user = userEvent.setup();
    render(<AreaTimeline areas={areas} />);
    await user.click(screen.getByRole("button", { name: /1 visita registrada/ }));
    expect(screen.getByText(/Plantio de 980 mudas concluído/i)).toBeInTheDocument();
  });

  it("plota os pontos quando o started_at é mais recente que as visitas", () => {
    render(
      <AreaTimeline
        areas={[
          {
            id: "area-rec",
            project_id: "proj-restauracao-norte",
            name: "Recente",
            biome: "Mata Atlântica",
            size_hectares: 42,
            restoration_status: "active",
            started_at: "2026-01-01",
            goal: null,
            seedlings: 1000,
            survival_rate: 90,
            monitorings: [
              {
                id: "mon-antigo",
                visit_date: "2025-06-20",
                author: "",
                notes: "Visita antiga.",
                seedling_count: 100,
                avg_height: 0.5,
                species_data: null,
                photos: [],
              },
              {
                id: "mon-novo",
                visit_date: "2026-06-20",
                author: "",
                notes: "Visita recente.",
                seedling_count: 100,
                avg_height: 1.2,
                species_data: null,
                photos: [],
              },
            ],
          },
        ]}
      />,
    );

    const dots = screen.getAllByRole("button", { name: /visita de/i });
    expect(dots).toHaveLength(2);
    const positions = dots.map((dot) => Number.parseFloat(dot.style.left));
    expect(Math.max(...positions)).toBeGreaterThan(0);
  });
});
