import { describe, expect, it } from "vitest";
import { isPolygonGeometry, polygonBounds, type PolygonGeometry } from "@/lib/geo";

describe("isPolygonGeometry", () => {
  it("aceita um polígono GeoJSON válido", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-46.7, -23.5],
          [-46.6, -23.5],
          [-46.6, -23.4],
          [-46.7, -23.4],
          [-46.7, -23.5],
        ],
      ],
    };
    expect(isPolygonGeometry(polygon)).toBe(true);
  });

  it("rejeita valores não-objeto", () => {
    expect(isPolygonGeometry(null)).toBe(false);
    expect(isPolygonGeometry(undefined)).toBe(false);
    expect(isPolygonGeometry("polígono")).toBe(false);
  });

  it("rejeita geometry com tipo diferente", () => {
    expect(isPolygonGeometry({ type: "MultiPolygon", coordinates: [] })).toBe(false);
  });

  it("rejeita coordinates vazio", () => {
    expect(isPolygonGeometry({ type: "Polygon", coordinates: [] })).toBe(false);
  });

  it("rejeita position com menos de 2 coordenadas", () => {
    expect(
      isPolygonGeometry({
        type: "Polygon",
        coordinates: [[[-46.7, -23.5], [-46.6], [-46.6, -23.4], [-46.7, -23.5]]],
      }),
    ).toBe(false);
  });

  it("rejeita ring com menos de 4 pontos", () => {
    expect(
      isPolygonGeometry({
        type: "Polygon",
        coordinates: [
          [
            [-46.7, -23.5],
            [-46.6, -23.5],
            [-46.6, -23.4],
          ],
        ],
      }),
    ).toBe(false);
  });

  it("rejeita coordenadas não finitas", () => {
    expect(
      isPolygonGeometry({
        type: "Polygon",
        coordinates: [
          [
            [-46.7, -23.5],
            [-46.6, -23.5],
            [-46.6, NaN],
            [-46.7, -23.5],
          ],
        ],
      }),
    ).toBe(false);
  });
});

describe("polygonBounds", () => {
  it("calcula a bbox [west, south, east, north]", () => {
    const polygon: PolygonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [-46.7, -23.5],
          [-46.5, -23.6],
          [-46.6, -23.4],
          [-46.7, -23.5],
        ],
      ],
    };
    expect(polygonBounds(polygon)).toEqual([-46.7, -23.6, -46.5, -23.4]);
  });
});
