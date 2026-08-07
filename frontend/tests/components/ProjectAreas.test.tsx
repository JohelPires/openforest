import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectAreas } from "@/components/features/project-areas";
import type { AreaRead } from "@/lib/api";

const { projectAreasMock } = vi.hoisted(() => ({
  projectAreasMock: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    projectAreas: projectAreasMock,
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
    created_at: "2019-04-12T00:00:00Z",
    updated_at: "2019-04-12T00:00:00Z",
  },
];

function renderSection() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectAreas projectId="proj-restauracao-norte" />
    </QueryClientProvider>,
  );
}

describe("ProjectAreas", () => {
  beforeEach(() => {
    projectAreasMock.mockReset();
  });

  afterEach(cleanup);

  it("renderiza a régua com as áreas do projeto", async () => {
    projectAreasMock.mockResolvedValue(areas);

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
    projectAreasMock.mockResolvedValue([]);

    renderSection();

    expect(
      await screen.findByText("As áreas deste projeto aparecem aqui"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Áreas do projeto" }),
    ).not.toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    projectAreasMock.mockRejectedValue(new Error("falha de rede"));

    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar as áreas/i,
    );
  });
});
