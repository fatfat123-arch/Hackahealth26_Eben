import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { preparePassportCard } from "@/lib/passport-card-download";
import { getPatient, type PatientResult } from "@/lib/patients.functions";
import { signPaths } from "@/lib/session";
import { createPassportCardPdf } from "@/lib/passport-card-pdf";

vi.mock("@/lib/patients.functions", () => ({ getPatient: vi.fn() }));
vi.mock("@/lib/session", () => ({ signPaths: vi.fn() }));
vi.mock("@/lib/passport-card-pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/passport-card-pdf")>()),
  createPassportCardPdf: vi.fn(),
}));
const saved: PatientResult = {
  id: "patient-1",
  public_id: "latest-public-id",
  name: "Élodie Exemple",
  birth_date: null,
  age: null,
  phone: "",
  phone_note: "",
  address: "",
  about: "",
  how_to: "",
  reminder: "",
  photo_path: null,
  photo_position_y: 50,
  dictionary: [],
  communicates: [],
  understanding_needs: [],
  tools: [],
  facilitators: [],
  interests: [],
  dislikes: [],
  additional: [],
  section_order: [],
  created_by: null,
  created_at: null,
  updated_at: null,
  archived_at: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPatient).mockResolvedValue(saved);
  vi.mocked(createPassportCardPdf).mockResolvedValue(new Uint8Array([7]));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => new Response(new Uint8Array([1]))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("Authenticated badge download data", () => {
  it("reads the saved name and current canonical URL without requiring a missing photo", async () => {
    const result = await preparePassportCard("patient-1");
    expect(result.filename).toBe("carte-elodie.pdf");
    expect(createPassportCardPdf).toHaveBeenCalledWith(
      "https://eh-passport.ch/passeport/latest-public-id",
      saved.name,
      expect.objectContaining({ photo: undefined }),
    );
    expect(signPaths).not.toHaveBeenCalled();
    const spy = vi.mocked(fetch);
    await vi.mocked(getPatient).mock.calls[0]![0]!.fetch!("/saved-profile", { method: "GET" });
    expect(spy).toHaveBeenLastCalledWith("/saved-profile", { method: "GET", cache: "no-store" });
  });

  it("does not generate a PDF when access is denied", async () => {
    vi.mocked(getPatient).mockRejectedValue(new Error("Session expirée"));
    await expect(preparePassportCard("patient-1")).rejects.toThrow("Session expirée");
    expect(createPassportCardPdf).not.toHaveBeenCalled();
    expect(signPaths).not.toHaveBeenCalled();
  });

  it("fails explicitly when an existing portrait's signed URL expires", async () => {
    vi.mocked(getPatient).mockResolvedValue({
      ...saved,
      photo_path: "private/photo.jpg",
      dictionary: [{ path: "private/movie.mp4" }],
    });
    vi.mocked(signPaths).mockResolvedValue({
      "private/photo.jpg": "/api/media?signature=temporary",
    });
    vi.mocked(fetch).mockImplementation(async (input) =>
      String(input).startsWith("/api/media")
        ? new Response(null, { status: 403 })
        : new Response(new Uint8Array([1])),
    );
    await expect(preparePassportCard("patient-1")).rejects.toThrow(
      "La photo du patient n’a pas pu être chargée",
    );
    expect(signPaths).toHaveBeenCalledWith(["private/photo.jpg"]);
    expect(createPassportCardPdf).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/media?signature=temporary",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
