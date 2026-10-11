import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, RotateCcw } from "lucide-react";
import { publicPassportUrl, linkUsesPreview } from "@/lib/site-url";
import { mascotArtwork } from "@/components/mascot";
import { askConfirm } from "@/components/backoffice/confirm-dialog";

export function PublicPassportLink({
  publicId,
  name,
  onReset,
}: {
  publicId: string;
  name: string;
  onReset: () => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [cardError, setCardError] = useState("");
  const [qrError, setQrError] = useState("");
  useEffect(() => {
    let active = true;
    const u = publicPassportUrl(publicId);
    setUrl(u);
    setQr("");
    setQrError("");
    QRCode.toDataURL(u, { width: 600, margin: 4, color: { dark: "#004d95", light: "#ffffff" } })
      .then((value) => {
        if (active) setQr(value);
      })
      .catch(() => {
        if (active)
          setQrError("Le code QR n’a pas pu être préparé. Rechargez la page pour réessayer.");
      });
    return () => {
      active = false;
    };
  }, [publicId]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  async function downloadCard() {
    if (!url || cardBusy) return;
    setCardBusy(true);
    setCardError("");
    setCardMessage("");
    try {
      const { downloadPassportCard } = await import("@/lib/passport-card-download");
      await downloadPassportCard({ url, name, artwork: mascotArtwork.carte });
      setCardMessage("Carte prête : le téléchargement du PDF a été lancé.");
    } catch {
      setCardError("La carte n’a pas pu être téléchargée. Merci de réessayer.");
    } finally {
      setCardBusy(false);
    }
  }
  async function resetUrl() {
    if (resetBusy) return;
    const ok = await askConfirm(
      "Cette action va créer une nouvelle adresse publique pour ce passeport. Les anciens codes QR et puces NFC qui utilisent l’adresse actuelle ne fonctionneront plus.",
      {
        kind: "save",
        title: "Réinitialiser le lien public ?",
        confirmLabel: "Réinitialiser le lien",
        cancelLabel: "Annuler",
      },
    );
    if (!ok) return;
    setResetBusy(true);
    setCardError("");
    setCardMessage("");
    try {
      await onReset();
      setCardMessage("Nouveau lien prêt. Remplacez les anciens codes QR et puces NFC.");
    } catch {
      setCardError("Le lien n’a pas pu être réinitialisé. Merci de réessayer.");
    } finally {
      setResetBusy(false);
    }
  }

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-");
  return (
    <section className="bo-card bo-link-card" aria-labelledby="link-title">
      <div>
        <h2 id="link-title">Lien vers la page publique</h2>
        <p>C’est l’adresse à mettre dans le code QR ou la puce NFC.</p>
        {linkUsesPreview() && (
          <p className="bo-hint">
            Ce lien utilise l’adresse de prévisualisation. Publiez le site pour obtenir le lien
            définitif à mettre sur le code QR ou la puce NFC.
          </p>
        )}
        <p className="bo-url">
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
        <div className="bo-actions">
          <button type="button" className="bo-btn bo-btn-outline" onClick={copy} disabled={!url}>
            <Copy aria-hidden="true" /> Copier le lien
          </button>
          {qr && (
            <a className="bo-btn bo-btn-outline" href={qr} download={`qr-passeport-${slug}.png`}>
              <Download aria-hidden="true" /> Télécharger le code QR
            </a>
          )}
          <button
            type="button"
            className="bo-btn bo-btn-outline"
            onClick={downloadCard}
            disabled={!url || cardBusy}
            aria-busy={cardBusy}
          >
            <Download aria-hidden="true" />{" "}
            {cardBusy ? "Préparation de la carte…" : "Télécharger la carte (PDF)"}
          </button>
          <button
            type="button"
            className="bo-btn bo-btn-outline"
            onClick={resetUrl}
            disabled={resetBusy}
            aria-busy={resetBusy}
          >
            <RotateCcw aria-hidden="true" />{" "}
            {resetBusy ? "Réinitialisation…" : "Réinitialiser le lien"}
          </button>
        </div>
        <p className="bo-hint">
          Carte avec la mascotte et le code QR, 9 × 7 cm sur une page A4. Imprimez à 100 % (taille
          réelle), puis découpez aux repères. Si vous réinitialisez le lien, remplacez les anciens
          codes QR et puces NFC : ils seront invalides.
        </p>
        {copied && (
          <p role="status" className="bo-hint">
            Lien copié.
          </p>
        )}
        {cardMessage && (
          <p role="status" className="bo-hint">
            {cardMessage}
          </p>
        )}
        {cardError && (
          <p role="alert" className="bo-error">
            {cardError}
          </p>
        )}
        {qrError && (
          <p role="alert" className="bo-error">
            {qrError}
          </p>
        )}
      </div>
      {qr && (
        <img
          className="bo-qr"
          src={qr}
          alt={`Code QR menant au passeport de ${name}`}
          width={180}
          height={180}
        />
      )}
    </section>
  );
}
