import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MonitoringList } from "@/components/features/monitoring-list";
import type { MonitoringRead } from "@/lib/api";

const items: MonitoringRead[] = [
  {
    id: "mon-1",
    area_id: "area-1",
    visit_date: "2024-06-01",
    notes: "Plantio concluído no quadrante 1.",
    seedling_count: 980,
    avg_height: 0.4,
    species_data: { Aroeira: {}, Angico: {} },
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  },
];

describe("MonitoringList", () => {
  afterEach(cleanup);

  it("renderiza data, notas, mudas, altura e espécies", () => {
    render(<MonitoringList items={items} />);
    expect(screen.getByText(/1 de junho de 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Plantio concluído no quadrante 1/i)).toBeInTheDocument();
    expect(screen.getByText("980 mudas")).toBeInTheDocument();
    expect(screen.getByText("0,4 m médios")).toBeInTheDocument();
    expect(screen.getByText("Aroeira")).toBeInTheDocument();
    expect(screen.getByText("Angico")).toBeInTheDocument();
  });

  it("gera thumbs de foto mockados quando o payload não traz fotos", () => {
    const { container } = render(<MonitoringList items={items} />);
    const thumbs = container.querySelectorAll("figure");
    expect(thumbs.length).toBeGreaterThan(0);
    expect(screen.getAllByText("jun/24").length).toBeGreaterThan(0);
    expect(screen.queryByText("sem foto")).not.toBeInTheDocument();
  });

  it("mostra o placeholder sem foto quando a lista de fotos é vazia", () => {
    const item = { ...items[0], photos: [] };
    render(<MonitoringList items={[item]} />);
    expect(screen.getByText("sem foto")).toBeInTheDocument();
  });

  it("não renderiza nada quando a lista está vazia", () => {
    const { container } = render(<MonitoringList items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
