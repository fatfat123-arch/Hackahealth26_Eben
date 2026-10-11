import { ArrowLeft } from "lucide-react";
import { PassportView } from "@/components/passport/passport-view";
import { toViewData, type PatientDraft } from "@/lib/patients";
import { PatientProfileDownload } from "./patient-profile-download";

export function PreviewPanel({
  draft,
  urls,
  updatedAt,
  onClose,
  patientId,
}: {
  draft: PatientDraft;
  urls: Record<string, string>;
  updatedAt: string | null;
  onClose: () => void;
  patientId?: string;
}) {
  return (
    <div>
      <div className="bo-preview-bar">
        <p>
          <strong>Aperçu</strong> — voici la page telle qu’elle apparaît après avoir scanné le code
          QR ou approché le badge NFC.
        </p>
        <div className="bo-preview-actions">
          {patientId && <PatientProfileDownload key={patientId} patientId={patientId} />}
          <button type="button" className="bo-btn bo-btn-primary" onClick={onClose}>
            <ArrowLeft aria-hidden="true" /> Fermer l’aperçu
          </button>
        </div>
      </div>
      <div className="bo-preview-frame">
        <PassportView data={toViewData(draft, urls, updatedAt)} />
      </div>
    </div>
  );
}
