import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BreadcrumbProvider,
  useBreadcrumb,
  useBreadcrumbSegments,
} from "@/components/features/painel-breadcrumb";

function Probe({ segments }: { segments: string[] }) {
  useBreadcrumb(segments);
  return null;
}

function Trail() {
  const segments = useBreadcrumbSegments();
  return (
    <nav aria-label="breadcrumb">
      {segments.map((segment) => (
        <span key={segment}>{segment}</span>
      ))}
    </nav>
  );
}

function Shell() {
  return (
    <BreadcrumbProvider>
      <Probe segments={["Projetos", "Corredor do Ribeirão"]} />
      <Trail />
    </BreadcrumbProvider>
  );
}

describe("BreadcrumbProvider", () => {
  afterEach(cleanup);

  it("expõe os segmentos registrados pelo hook", async () => {
    render(<Shell />);
    expect(await screen.findByText("Corredor do Ribeirão")).toBeInTheDocument();
    expect(screen.getByText("Projetos")).toBeInTheDocument();
  });
});
