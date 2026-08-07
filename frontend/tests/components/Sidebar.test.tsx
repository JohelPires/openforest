import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/features/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/painel/projetos",
}));

vi.mock("@/components/features/user-provider", () => ({
  useUser: () => ({
    organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
    user: null,
  }),
}));

describe("Sidebar", () => {
  afterEach(cleanup);

  it("mostra a navegação hierárquica por contexto", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Projetos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fotos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configurações/ })).toBeInTheDocument();
  });

  it("não lista Áreas, Monitoramentos e Sensores no nível raiz", () => {
    render(<Sidebar />);
    expect(screen.queryByRole("link", { name: /Áreas/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Monitoramentos/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sensores/ })).not.toBeInTheDocument();
  });
});
