import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectAreas } from "@/components/features/project-areas";

vi.mock("@/components/reveal", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("ProjectAreas", () => {
  afterEach(cleanup);

  it("renderiza a régua com as áreas do projeto demo", () => {
    render(<ProjectAreas projectId="proj-restauracao-norte" />);
    expect(screen.getByRole("heading", { name: "Áreas do projeto" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Borrazóis" })).toBeInTheDocument();
  });

  it("mostra convite vazio para projeto sem áreas", () => {
    render(<ProjectAreas projectId="proj-sem-areas" />);
    expect(
      screen.getByText("As áreas deste projeto aparecem aqui"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Áreas do projeto" }),
    ).not.toBeInTheDocument();
  });
});
