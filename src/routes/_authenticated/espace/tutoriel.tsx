import { publicPassportUrl } from "@/lib/site-url";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { BackLink } from "@/components/backoffice/back-link";
import { Mascot } from "@/components/mascot";

export const Route = createFileRoute("/_authenticated/espace/tutoriel")({
  validateSearch: (s) => z.object({ id: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Tutoriel QR code et NFC — Espace professionnel" }, { name: "description", content: "Créer un code QR ou programmer une puce NFC vers un passeport." }, { property: "og:title", content: "Tutoriel QR code et NFC" }, { property: "og:description", content: "Créer un code QR ou programmer une puce NFC vers un passeport." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] }),
  component: Tutorial,
});

function Tutorial() {
  const { id } = Route.useSearch();
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(id ? publicPassportUrl(id) : ""); }, [id]);
  const link = url || "l’adresse de la page publique du patient";

  return <article className="bo-tutorial">
    {id ? <BackLink to="/espace/patients/$id" params={{ id }}>Retour au profil</BackLink> : <BackLink to="/espace/patients">Retour aux profils des patients</BackLink>}
    <h1 className="bo-title">Tutoriel : relier le passeport à un code QR ou une puce NFC</h1>
    <div className="title-underline" />
    <div className="bo-intro"><Mascot pose="qr" size={120} /><p>Suivez ces quatre étapes simples. Vous n’avez besoin que d’un téléphone et de quelques minutes.</p></div>
    <section className="bo-card">
      <h2>1. Trouver le lien du passeport</h2>
      <p>Chaque patient a sa propre page publique. C’est elle qui s’affiche lorsque quelqu’un scanne le code.</p>
      {url ? <p className="bo-url">Lien de ce patient : <strong>{url}</strong></p> : <p>Le lien est affiché sur la page du profil, dans l’encadré « Lien vers la page publique ».</p>}
      <p>Le profil doit être <strong>enregistré</strong> pour que la page publique fonctionne.</p>
    </section>
    <section className="bo-card">
      <h2>2. Créer un code QR</h2>
      <ol className="bo-steps">
        <li>Ouvrez le profil du patient dans cet espace.</li>
        <li>Dans l’encadré « Lien vers la page publique », cliquez sur <strong>Télécharger le code QR</strong>. Une image est enregistrée sur votre appareil.</li>
        <li>Imprimez l’image en taille suffisante : au moins 3 cm de côté.</li>
        <li>Collez-la sur un support que la personne garde avec elle : carte plastifiée, porte-clés, bracelet, étiquette de sac.</li>
        <li>Testez le code : ouvrez l’appareil photo d’un téléphone, visez le code et vérifiez que le passeport s’affiche.</li>
      </ol>
    </section>
    <section className="bo-card">
      <h2>3. Programmer une puce NFC</h2>
      <p>Une puce NFC permet d’ouvrir le passeport en approchant simplement un téléphone, sans scanner.</p>
      <ol className="bo-steps">
        <li>Procurez-vous une puce NFC vierge (autocollant, carte ou porte-clés, modèle NTAG213 ou NTAG215).</li>
        <li>Installez sur votre téléphone une application gratuite d’écriture NFC, par exemple « NFC Tools ».</li>
        <li>Activez le NFC dans les réglages du téléphone (sur iPhone, il est toujours actif).</li>
        <li>Dans l’application, choisissez <strong>Écrire</strong>, puis <strong>Ajouter un enregistrement</strong>, puis <strong>URL / Lien</strong>.</li>
        <li>Collez le lien : <strong>{link}</strong>. Utilisez le bouton « Copier le lien » du profil pour éviter les erreurs.</li>
        <li>Lancez l’écriture et approchez la puce du dos du téléphone jusqu’à la confirmation.</li>
        <li>Testez : approchez un autre téléphone de la puce et vérifiez que le passeport s’ouvre.</li>
      </ol>
      <p>Conseil : vous pouvez verrouiller la puce dans l’application pour éviter qu’elle soit modifiée par erreur. Ce verrouillage est définitif.</p>
    </section>
    <section className="bo-card">
      <h2>4. Mettre à jour le passeport</h2>
      <p>Il n’est pas nécessaire de refaire le code QR ou la puce après une modification : le lien reste le même et la page affiche toujours les informations les plus récentes.</p>
    </section>
  </article>;
}
