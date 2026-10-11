import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatientProfileDownload } from "@/components/backoffice/patient-profile-download";
import { getPatient, type PatientResult } from "@/lib/patients.functions";
import { preparePatientProfilePdf, savePatientProfilePdf } from "@/lib/patient-profile-download";

vi.mock("@/lib/patients.functions", () => ({ getPatient: vi.fn() }));
vi.mock("@/lib/patient-profile-download", () => ({ preparePatientProfilePdf: vi.fn(), savePatientProfilePdf: vi.fn() }));
const saved: PatientResult = {
  id: "patient-id", name: "Dernier nom enregistré", age: null, birth_date: null,
  phone: "", phone_note: "", address: "", about: "", how_to: "", reminder: "", photo_path: null, photo_position_y: 50,
  created_by: null, created_at: null, updated_at: null, archived_at: null,
  interests: ["Dernière information enregistrée"], dislikes: [], additional: [], section_order: ["interests"], dictionary: [],
  communicates: [], understanding_needs: [], tools: [], facilitators: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPatient).mockResolvedValue(saved);
  vi.mocked(preparePatientProfilePdf).mockResolvedValue({ bytes: new Uint8Array([1]), filename: "Profil_Dernier_nom_enregistré.pdf" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Download saved patient profile", () => {
  it("reads fresh saved data on every click and sends only printable data to the generator", async () => {
    render(<PatientProfileDownload patientId="patient-id" />);
    fireEvent.click(screen.getByRole("button", { name: "Télécharger le profil (PDF)" }));
    await screen.findByRole("status");
    expect(getPatient).toHaveBeenCalledWith({ data: "patient-id", fetch: expect.any(Function) });
    expect(preparePatientProfilePdf).toHaveBeenCalledWith({ name: saved.name, sections: [{ key: "interests", title: "Mes centres d’intérêt", items: saved.interests }] });
    vi.mocked(getPatient).mockResolvedValue({ ...saved, name: "Nouveau nom", interests: ["Nouveau contenu"] });
    fireEvent.click(screen.getByRole("button", { name: "Télécharger le profil (PDF)" }));
    await waitFor(() => expect(savePatientProfilePdf).toHaveBeenCalledTimes(2));
    expect(preparePatientProfilePdf).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Nouveau nom" }));
    const fetchSpy = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchSpy);
    await vi.mocked(getPatient).mock.calls[0]![0]!.fetch!("/latest-profile", { method: "GET" });
    expect(fetchSpy).toHaveBeenCalledWith("/latest-profile", { method: "GET", cache: "no-store" });
  });

  it("does not generate or download after access is refused", async () => {
    vi.mocked(getPatient).mockRejectedValue(new Error("Session expirée"));
    render(<PatientProfileDownload patientId="patient-id" />);
    fireEvent.click(screen.getByRole("button", { name: "Télécharger le profil (PDF)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("reconnectez-vous");
    expect(preparePatientProfilePdf).not.toHaveBeenCalled();
    expect(savePatientProfilePdf).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("shows loading, prevents duplicate work, and allows retry after generation fails", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(preparePatientProfilePdf).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    render(<PatientProfileDownload patientId="patient-id" />);
    const button = screen.getByRole("button");
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(preparePatientProfilePdf).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Préparation du profil");
    await act(async () => { reject(new Error("Font unavailable")); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Le profil n’a pas pu être téléchargé");
    fireEvent.click(button);
    await screen.findByRole("status");
    expect(savePatientProfilePdf).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not download a stale profile after navigating away", async () => {
    let finish!: (value: Awaited<ReturnType<typeof preparePatientProfilePdf>>) => void;
    vi.mocked(preparePatientProfilePdf).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { unmount } = render(<PatientProfileDownload patientId="patient-id" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(preparePatientProfilePdf).toHaveBeenCalled());
    unmount();
    await act(async () => { finish({ bytes: new Uint8Array([1]), filename: "Profil_Test.pdf" }); });
    expect(savePatientProfilePdf).not.toHaveBeenCalled();
  });
});
