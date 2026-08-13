import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitoringPhoto } from "@/components/features/monitoring-photo";
import type { PhotoRead } from "@/lib/api";

const { downloadPhotoMock } = vi.hoisted(() => ({ downloadPhotoMock: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, downloadPhoto: downloadPhotoMock };
});

const photo: PhotoRead = {
  id: "photo-1",
  monitoring_id: "mon-1",
  file_path: "/uploads/mon-1/visita.jpg",
  original_filename: "visita.jpg",
  mime_type: "image/jpeg",
  file_size: 2048,
  created_at: "2024-06-01T10:00:00Z",
  updated_at: "2024-06-01T10:00:00Z",
};

describe("MonitoringPhoto", () => {
  beforeEach(() => {
    downloadPhotoMock.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(cleanup);

  it("baixa a foto e renderiza como imagem", async () => {
    downloadPhotoMock.mockResolvedValue(new Blob(["foto"], { type: "image/jpeg" }));

    render(<MonitoringPhoto photo={photo} />);

    const img = await screen.findByRole("img", { name: "visita.jpg" });
    expect(img).toHaveAttribute("src", "blob:mock-url");
    expect(downloadPhotoMock).toHaveBeenCalledWith("photo-1");
  });

  it("mostra erro e permite tentar novamente", async () => {
    downloadPhotoMock
      .mockRejectedValueOnce(new Error("falha"))
      .mockResolvedValueOnce(new Blob(["foto"], { type: "image/jpeg" }));

    render(<MonitoringPhoto photo={photo} />);

    const retry = await screen.findByRole("button", { name: /Tentar novamente/ });
    const user = userEvent.setup();
    await user.click(retry);

    expect(await screen.findByRole("img", { name: "visita.jpg" })).toBeInTheDocument();
    expect(downloadPhotoMock).toHaveBeenCalledTimes(2);
  });
});
