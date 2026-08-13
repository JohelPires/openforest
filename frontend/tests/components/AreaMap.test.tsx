import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AreaMap } from "@/components/features/area-map";
import type { AreaRead } from "@/lib/api";

const { mapInstances } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    on: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    on = vi.fn();
    addSource = vi.fn();
    addLayer = vi.fn();
    fitBounds = vi.fn();
    remove = vi.fn();
    constructor() {
      mapInstances.push(this);
    }
  }
  return { default: { Map: MockMap }, Map: MockMap };
});

function polygonArea(): AreaRead {
  return {
    id: "area-1",
    project_id: "proj-1",
    name: "Borrazóis",
    biome: "Mata Atlântica",
    size_hectares: 42,
    restoration_status: "active",
    coordinates: {
      type: "Polygon",
      coordinates: [
        [
          [-46.7, -23.5],
          [-46.5, -23.6],
          [-46.6, -23.4],
          [-46.7, -23.5],
        ],
      ],
    },
    created_at: "2024-05-01T00:00:00Z",
    updated_at: "2024-05-01T00:00:00Z",
  };
}

function triggerLoad(map: (typeof mapInstances)[number]) {
  const loadCall = map.on.mock.calls.find(([event]) => event === "load");
  expect(loadCall).toBeDefined();
  (loadCall?.[1] as () => void)?.();
}

describe("AreaMap", () => {
  beforeEach(() => {
    mapInstances.length = 0;
  });

  afterEach(cleanup);

  it("mostra fallback quando não há coordenadas", () => {
    render(<AreaMap area={{ ...polygonArea(), coordinates: null }} />);
    expect(screen.getByText("coordenadas em breve")).toBeInTheDocument();
    expect(mapInstances).toHaveLength(0);
  });

  it("cria o mapa com a feature GeoJSON do polígono", async () => {
    const area = polygonArea();
    render(<AreaMap area={area} />);

    const map = mapInstances[0];
    expect(map).toBeDefined();

    triggerLoad(map);

    expect(map.addSource).toHaveBeenCalledWith("area", {
      type: "geojson",
      data: { type: "Feature", geometry: area.coordinates, properties: {} },
    });
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ type: "fill" }));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ type: "line" }));
    expect(map.fitBounds).toHaveBeenCalledWith(
      [-46.7, -23.6, -46.5, -23.4],
      expect.any(Object),
    );
  });

  it("mostra fallback quando a geometry é inválida", () => {
    render(
      <AreaMap
        area={{
          ...polygonArea(),
          coordinates: {
            type: "MultiPolygon",
            coordinates: [],
          } as unknown as AreaRead["coordinates"],
        }}
      />,
    );
    expect(screen.getByText("coordenadas em breve")).toBeInTheDocument();
    expect(mapInstances).toHaveLength(0);
  });
});
