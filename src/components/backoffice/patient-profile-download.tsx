import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { getPatient } from "@/lib/patients.functions";
import { rowToDraft, type PatientRow } from "@/lib/patients";
import { printablePatientProfile } from "@/lib/printable-patient-profile";

export function PatientProfileDownload({ patientId }: { patientId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    locked.current = false; setBusy(false); setError(""); setMessage("");
    return () => { generation.current++; };
  }, [patientId]);

  async function download() {
    if (locked.current) return;
    locked.current = true;
    const current = ++generation.current;
    setBusy(true); setError(""); setMessage("");
    try {
      // Re-read through the same authenticated access path as the profile, never a cached draft.
      const [saved, renderer] = await Promise.all([
        getPatient({ data: patientId, fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) }),
        import("@/lib/patient-profile-download"),
      ]);
      if (!saved) throw new Error("Profil introuvable.");
      if (current !== generation.current) return;
      const profile = printablePatientProfile(rowToDraft(saved as unknown as PatientRow));
      const result = await renderer.preparePatientProfilePdf(profile);
      if (current !== generation.current) return;
      renderer.savePatientProfilePdf(result);
      setMessage("Le téléchargement du profil PDF a été lancé.");
    } catch {
      if (current === generation.current) setError("Le profil n’a pas pu être téléchargé. Réessayez ou reconnectez-vous.");
    } finally {
      if (current === generation.current) { locked.current = false; setBusy(false); }
    }
  }
  return <>
    <button type="button" className="bo-btn bo-btn-outline" onClick={download} disabled={busy} aria-busy={busy}>
      {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
      {busy ? "Préparation du profil…" : "Télécharger le profil (PDF)"}
    </button>
    {message && <span className="sr-only" role="status">{message}</span>}
    {error && <p className="bo-error bo-profile-pdf-error" role="alert">{error}</p>}
  </>;
}
