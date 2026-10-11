import { publicPassportUrl } from "@/lib/site-url";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { BackLink } from "@/components/backoffice/back-link";
import { Mascot } from "@/components/mascot";
import { TutorialPhotos } from "@/components/backoffice/tutorial-photos";
import nfcToolsIcon from "@/assets/nfc-tools-icon.png";
import nfc01 from "@/assets/nfc-01-accueil.jpg";
import nfc02 from "@/assets/nfc-02-ecrire.jpg";
import nfc03 from "@/assets/nfc-03-enregistrement.jpg";
import nfc04 from "@/assets/nfc-04-url-vide.jpg";
import nfc05 from "@/assets/nfc-05-url-remplie.jpg";
import nfc06 from "@/assets/nfc-06-url-ajoutee.jpg";
import nfc07 from "@/assets/nfc-07-ecrire-tag.jpg";
import nfc08 from "@/assets/nfc-08-ecriture-terminee.jpg";

export const Route = createFileRoute("/_authenticated/espace/tutoriel")({
  validateSearch: (s) => z.object({ id: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Tutoriel QR code et NFC — Espace professionnel" }, { name: "description", content: "Créer un code QR ou programmer une puce NFC vers un passeport." }, { property: "og:title", content: "Tutoriel QR code et NFC" }, { property: "og:description", content: "Créer un code QR ou programmer une puce NFC vers un passeport." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] }),
  component: Tutorial,
});

function Tutorial() {
  const { id } = Route.useSearch();
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(id ? publicPassportUrl(id) : ""); }, [id]);
  const link = url || "le lien public copié depuis le profil du résident";

  return <article className="bo-tutorial">
    {id ? <BackLink to="/espace/patients/$id" params={{ id }}>Retour au profil</BackLink> : <BackLink to="/espace/patients">Retour aux profils des résidents</BackLink>}
    <h1 className="bo-title">Tutoriel : utiliser un code QR et un badge NFC</h1>
    <div className="title-underline" />
    <div className="bo-intro"><Mascot pose="qr" size={120} /><p>Le code QR et le badge NFC ouvrent exactement le même passeport. Suivez les étapes dans l’ordre et testez toujours le support avant de le remettre au résident.</p></div>
    <section className="bo-card">
      <h2>1. Récupérer le lien du passeport</h2>
      <ol className="bo-steps"><li>Ouvrez le profil du résident.</li><li>Enregistrez le profil pour créer sa page publique.</li><li>Dans « Lien vers la page publique », touchez <strong>Copier le lien</strong>.</li><li>Vérifiez que le nom correspond au bon résident.</li></ol>
      {url ? <p className="bo-url">Lien à utiliser pour ce résident : <strong>{url}</strong></p> : <p>Ouvrez d’abord un profil pour afficher ici son lien exact.</p>}
    </section>
    <section className="bo-card">
      <h2>2. Préparer et tester le code QR</h2>
      <ol className="bo-steps">
        <li>Sur le profil, touchez <strong>Télécharger le code QR</strong> pour obtenir l’image seule, ou <strong>Télécharger la carte (PDF)</strong> pour une carte avec la mascotte.</li><li>Pour la carte de 9 × 7 cm, imprimez le PDF sur une page A4 à <strong>100 % (taille réelle)</strong>, puis découpez aux repères. Pour le code QR seul, imprimez-le au minimum en 3 cm sur 3 cm, sur fond clair.</li><li>Placez-le sur le badge sans le plier ni le recouvrir d’un élément brillant.</li><li>Visez-le avec l’appareil photo d’un autre téléphone.</li><li>Touchez la notification et vérifiez que le passeport du bon résident s’ouvre.</li>
      </ol>
    </section>
    <section className="bo-card">
      <h2>3. Programmer le badge NFC</h2>
      <p>Le badge NFC contient uniquement le lien du passeport. En approchant un téléphone compatible, une notification permet d’ouvrir la page du résident.</p>
      <h3>Avant de commencer</h3>
      <ul className="bo-steps">
        <li>Préparez un badge NFC vierge <strong>NTAG213 ou NTAG215</strong>.</li>
        <li>Installez l’application gratuite <strong>NFC Tools</strong> <img src={nfcToolsIcon} alt="Icône de l’application NFC Tools : un téléphone blanc avec un N sur fond orange" className="app-icon" width={28} height={28} />.</li>
        <li>Sur Android, activez le NFC dans les réglages. Sur les iPhone récents, la lecture est disponible automatiquement.</li>
        <li>Copiez le lien du bon résident depuis son profil.</li>
      </ul>
      <h3>Écrire le lien sur le badge</h3>
      <ol className="bo-steps">
        <li>Ouvrez <strong>NFC Tools</strong> <img src={nfcToolsIcon} alt="Icône de NFC Tools" className="app-icon" width={28} height={28} />, puis touchez <strong>Écrire</strong>. <span className="step-ref">(image 1)</span></li>
        <li>Touchez <strong>Ajouter un enregistrement</strong>. <span className="step-ref">(image 2)</span></li>
        <li>Choisissez <strong>URL / URI</strong>. <span className="step-ref">(image 3)</span></li>
        <li>Collez le lien : <strong>{link}</strong>. Depuis votre téléphone, c’est le lien de la page du résident que vous obtenez quand vous scannez le code QR, et qui apparaît en haut de la page. <span className="step-ref">(image 4)</span></li>
        <li>Vérifiez le lien, puis touchez <strong>Valider</strong>. <span className="step-ref">(image 5)</span></li>
        <li>Touchez <strong>Écrire</strong>. <span className="step-ref">(image 6)</span></li>
        <li>Maintenez le badge sans bouger contre le haut d’un iPhone ou le centre du dos d’un Android. <span className="step-ref">(image 7)</span></li>
        <li>Attendez le message <strong>Écriture terminée</strong>. <span className="step-ref">(image 8)</span></li>
      </ol>
      <p><strong>Important :</strong> ne verrouillez pas encore le badge. Testez-le d’abord : le verrouillage est définitif.</p>
      <TutorialPhotos photos={[
        { src: nfc01, title: "Image 1 — Ouvrir « Écrire »", explanation: "Sélectionnez l’onglet Écrire en haut de l’écran.", alt: "Écran d’accueil de NFC Tools, bouton Écrire entouré", highlight: { cx: 37.5, cy: 14, rx: 11, ry: 2.5 } },
        { src: nfc02, title: "Image 2 — Ajouter un enregistrement", explanation: "Choisissez le contenu à placer dans le badge.", alt: "Onglet Écrire de NFC Tools, bouton Ajouter un enregistrement entouré", highlight: { cx: 50, cy: 21, rx: 46, ry: 3.5 } },
        { src: nfc03, title: "Image 3 — Choisir URL / URI", explanation: "Cette option permet d’ouvrir directement le passeport.", alt: "Liste des types d’enregistrement de NFC Tools, option URL / URI entourée", highlight: { cx: 42, cy: 22.9, rx: 25, ry: 3.2 } },
        { src: nfc04, title: "Image 4 — Coller le lien", explanation: "Collez le lien public copié depuis le profil du résident.", alt: "Champ URL vide de NFC Tools", highlight: { cx: 45, cy: 15.2, rx: 32, ry: 3 } },
        { src: nfc05, title: "Image 5 — Valider le lien", explanation: "Vérifiez qu’il commence par https://eh-passport.ch/passeport/, puis validez.", alt: "Champ URL rempli avec le lien du passeport, bouton Valider entouré", highlight: { cx: 74, cy: 89.4, rx: 24, ry: 3.8 } },
        { src: nfc06, title: "Image 6 — Lancer l’écriture", explanation: "Lorsque l’URL apparaît dans la liste, touchez Écrire.", alt: "Enregistrement URL ajouté, bouton Écrire entouré", highlight: { cx: 50, cy: 35.9, rx: 46, ry: 3.6 } },
        { src: nfc07, title: "Image 7 — Approcher le badge", explanation: "Gardez le badge immobile contre le téléphone.", alt: "Demande d’approcher un badge NFC" },
        { src: nfc08, title: "Image 8 — Vérifier la confirmation", explanation: "Écriture terminée confirme que le lien est enregistré.", alt: "Confirmation « Écriture terminée »" },
      ]} />
      <h3>Tester le badge avant de le distribuer</h3>
      <ol className="bo-steps"><li>Fermez NFC Tools ou prenez un deuxième téléphone.</li><li>Déverrouillez le téléphone et approchez-le du badge.</li><li>Touchez la notification.</li><li>Vérifiez le nom du résident et la lecture des vidéos.</li><li>Inscrivez le nom du résident sur le badge ou son emballage.</li></ol>
      <h3>Si le badge ne réagit pas</h3>
      <ul className="bo-steps"><li>Retirez une coque épaisse ou métallique.</li><li>Déplacez lentement le badge sur le dos du téléphone.</li><li>Sur Android, vérifiez que le NFC est activé.</li><li>Relisez le badge dans NFC Tools pour vérifier l’URL.</li></ul>
    </section>
    <section className="bo-card">
      <h2>4. Mettre à jour le passeport</h2>
      <p>Après une modification, il n’est pas nécessaire de réimprimer le code QR ni de reprogrammer le badge NFC : le lien reste identique et affiche automatiquement les informations les plus récentes.</p>
    </section>
  </article>;
}
