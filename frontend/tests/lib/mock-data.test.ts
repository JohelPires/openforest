import { describe, expect, it } from "vitest";
import { projectAreas } from "@/lib/mock-data";

describe("projectAreas", () => {
  it("retorna as áreas associadas ao projeto", () => {
    const areas = projectAreas("proj-restauracao-norte");
    expect(areas.length).toBeGreaterThan(0);
    expect(areas.every((a) => a.project_id === "proj-restauracao-norte")).toBe(true);
  });

  it("retorna lista vazia para projeto sem áreas", () => {
    expect(projectAreas("proj-inexistente")).toEqual([]);
  });
});
