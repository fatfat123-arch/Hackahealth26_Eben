import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download } from "lucide-react";
import { publicPassportUrl, linkUsesPreview } from "@/lib/site-url";
import { mascotArtwork } from "@/components/mascot";

export function PublicPassportLink({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [cardError, setCardError] = useState("");
  const [qrError, setQrError] = useState("");
  useEffect(() => {
    let active = true;
    const u = publicPassportUrl(id);
    setUrl(u);
    setQr("");
    setQrError("");
    QRCode.toDataURL(u, { width: 600, margin: 4, color: { dark: "#004d95", light: "#ffffff" } })
      .then(value => { if (active) setQr(value); })
      .catch(() => { if (active) setQrError("Le code QR n’a pas pu être préparé. Rechargez la page pour réessayer."); });
    return () => { active = false; };
  }, [id]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }
  async function downloadCard() {
    if (!url || cardBusy) return;
    setCardBusy(true); setCardError(""); setCardMessage("");
    try {
      const { downloadPassportCard } = await import("@/lib/passport-card-download");
      await downloadPassportCard({ url, name, artwork: mascotArtwork.carte });
      setCardMessage("Carte prête : le téléchargement du PDF a été lancé.");
    } catch {
      setCardError("La carte n’a pas pu être téléchargée. Merci de réessayer.");
    } finally { setCardBusy(false); }
  }
  const slug = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
  return <section className="bo-card bo-link-card" aria-labelledby="link-title">
    <div>
      <h2 id="link-title">Lien vers la page publique</h2>
      <p>C’est l’adresse à mettre dans le code QR ou la puce NFC.</p>
      {linkUsesPreview() && <p className="bo-hint">Ce lien utilise l’adresse de prévisualisation. Publiez le site pour obtenir le lien définitif à mettre sur le code QR ou la puce NFC.</p>}
      <p className="bo-url"><a href={url} target="_blank" rel="noreferrer">{url}</a></p>
      <div className="bo-actions">
        <button type="button" className="bo-btn bo-btn-outline" onClick={copy} disabled={!url}><Copy aria-hidden="true" /> Copier le lien</button>
        {qr && <a className="bo-btn bo-btn-outline" href={qr} download={`qr-passeport-${slug}.png`}><Download aria-hidden="true" /> Télécharger le code QR</a>}
        <button type="button" className="bo-btn bo-btn-outline" onClick={downloadCard} disabled={!url || cardBusy} aria-busy={cardBusy}><Download aria-hidden="true" /> {cardBusy ? "Préparation de la carte…" : "Télécharger la carte (PDF)"}</button>
      </div>
      <p className="bo-hint">Carte avec la mascotte et le code QR, 9 × 7 cm sur une page A4. Imprimez à 100 % (taille réelle), puis découpez aux repères.</p>
      {copied && <p role="status" className="bo-hint">Lien copié.</p>}
      {cardMessage && <p role="status" className="bo-hint">{cardMessage}</p>}
      {cardError && <p role="alert" className="bo-error">{cardError}</p>}
      {qrError && <p role="alert" className="bo-error">{qrError}</p>}
    </div>
    {qr && <img className="bo-qr" src={qr} alt={`Code QR menant au passeport de ${name}`} width={180} height={180} />}
  </section>;
}
