import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { PublicPassportLink } from "@/components/backoffice/public-passport-link";
import { askConfirm } from "@/components/backoffice/confirm-dialog";
import { downloadPassportCard } from "@/lib/passport-card-download";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn() } }));
vi.mock("@/lib/passport-card-download", () => ({ downloadPassportCard: vi.fn() }));
vi.mock("@/components/backoffice/confirm-dialog", () => ({
  askConfirm: vi.fn().mockResolvedValue(true),
}));
const generateQr = vi.mocked(
  QRCode.toDataURL as (url: string, options?: QRCode.QRCodeToDataURLOptions) => Promise<string>,
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(askConfirm).mockResolvedValue(true);
  generateQr.mockResolvedValue("data:image/png;base64,cXI=");
  vi.mocked(downloadPassportCard).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("Profile passport downloads", () => {
  it("keeps the standalone PNG and downloads a card for the same public profile", async () => {
    render(<PublicPassportLink publicId="resident-demo" name="Élodie Exemple" onReset={vi.fn()} />);
    const qrLink = await screen.findByRole("link", { name: "Télécharger le code QR" });
    expect(qrLink).toHaveAttribute("download", expect.stringMatching(/\.png$/));
    expect(qrLink).toHaveAttribute("href", "data:image/png;base64,cXI=");
    fireEvent.click(screen.getByRole("button", { name: "Télécharger la carte (PDF)" }));
    await screen.findByRole("status");
    const publicLink = screen.getByRole("link", {
      name: "https://eh-passport.ch/passeport/resident-demo",
    });
    expect(downloadPassportCard).toHaveBeenCalledWith({
      url: publicLink.getAttribute("href"),
      name: "Élodie Exemple",
      artwork: expect.stringContaining("mascotte-carte.png"),
    });
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      publicLink.getAttribute("href"),
      expect.any(Object),
    );
  });

  it("blocks duplicate downloads during generation, then allows retry after a failure", async () => {
    let rejectDownload!: (reason: Error) => void;
    vi.mocked(downloadPassportCard).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectDownload = reject;
      }),
    );
    render(<PublicPassportLink publicId="resident-demo" name="Élodie Exemple" onReset={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "Télécharger la carte (PDF)" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(downloadPassportCard).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    rejectDownload(new Error("Artwork unavailable"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La carte n’a pas pu être téléchargée",
    );
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await screen.findByRole("status");
    expect(downloadPassportCard).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show an old QR if profiles change while generation is pending", async () => {
    let finishFirst!: (value: string) => void;
    generateQr.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishFirst = resolve;
      }),
    );
    const { rerender } = render(
      <PublicPassportLink publicId="first" name="Premier" onReset={vi.fn()} />,
    );
    rerender(<PublicPassportLink publicId="second" name="Deuxième" onReset={vi.fn()} />);
    await screen.findByRole("img", { name: "Code QR menant au passeport de Deuxième" });
    await act(async () => {
      finishFirst("data:image/png;base64,b2xk");
    });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Télécharger le code QR" })).toHaveAttribute(
        "href",
        "data:image/png;base64,cXI=",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Télécharger la carte (PDF)" }));
    await screen.findByRole("status");
    expect(downloadPassportCard).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://eh-passport.ch/passeport/second", name: "Deuxième" }),
    );
  });

  it("warns before resetting and regenerates the displayed public link", async () => {
    function Harness() {
      const [publicId, setPublicId] = useState("old-tag");
      return (
        <PublicPassportLink
          publicId={publicId}
          name="Élodie Exemple"
          onReset={async () => setPublicId("new-tag")}
        />
      );
    }
    render(<Harness />);
    await screen.findByRole("link", { name: "https://eh-passport.ch/passeport/old-tag" });
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser le lien" }));
    expect(askConfirm).toHaveBeenCalledWith(
      expect.stringContaining("anciens codes QR et puces NFC"),
      expect.objectContaining({ title: "Réinitialiser le lien public ?" }),
    );
    expect(
      await screen.findByRole("link", { name: "https://eh-passport.ch/passeport/new-tag" }),
    ).toBeInTheDocument();
    expect(QRCode.toDataURL).toHaveBeenLastCalledWith(
      "https://eh-passport.ch/passeport/new-tag",
      expect.any(Object),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Remplacez les anciens codes QR et puces NFC",
    );
  });
});
