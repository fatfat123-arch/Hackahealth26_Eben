import { Info, Plus, Minus, Cake, MapPin, CalendarCheck } from "lucide-react";
import { Mascot } from "@/components/mascot";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Accordion, AccordionItem, AccordionContent } from "@/components/ui/accordion";
import { DictionaryCard } from "@/components/passport/dictionary-card";
import type { DictionaryEntry } from "@/data/passport";
import { Button } from "@/components/ui/button";
import dictionaryIcon from "@/assets/passport-dictionnaire.png.asset.json";
import interestsIcon from "@/assets/passport-interets.png.asset.json";
import dislikesIcon from "@/assets/passport-peurs.png.asset.json";
import informationIcon from "@/assets/passport-informations.png.asset.json";

export type PassportViewData = {
  name: string;
  birthDate: string;
  phone: string;
  phoneHref: string;
  phoneNote: string;
  contactName: string;
  contactRelationship: string;
  contactPhone: string;
  address: string;
  updatedAt: string;
  updatedAtISO: string;
  portrait?: string | null | undefined;
  portraitAlt: string;
  about: string;
  howTo: string;
  reminder: string;
  dictionary: DictionaryEntry[];
  interests: string[];
  dislikes: string[];
  additional: string[];
};

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return <AccordionPrimitive.Header asChild>
    <h2>
      <AccordionPrimitive.Trigger className="passport-trigger">
        <span className="section-title"><img className="section-icon" src={icon} alt="" aria-hidden="true" width={48} height={48} /><span>{title}</span></span>
        <span className="section-toggle" aria-hidden="true"><Plus className="closed-icon" /><Minus className="open-icon" /></span>
      </AccordionPrimitive.Trigger>
    </h2>
  </AccordionPrimitive.Header>;
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <p>Aucune information pour le moment.</p>;
  return <ul className="passport-tags">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <p>Aucune information pour le moment.</p>;
  return <ul className="passport-list">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

export function PassportView({ data, demo = false }: { data: PassportViewData; demo?: boolean }) {
  const firstName = data.name.trim().split(/\s+/)[0];
  const contactFirstName = data.contactName.trim().split(/\s+/)[0];
  const contactHref = `tel:${data.contactPhone.replace(/[^+\d]/g, "")}`;
  return (
    <div className="passport-page">
      <header className="passport-heading">
        <p className="passport-kicker">Passeport de communication</p>
        <h1>{firstName ? `Bonjour, je m’appelle ${firstName}` : "Bonjour"}</h1>
        <div className="title-underline" />
      </header>
      <section className="profile-section" aria-label={`Profil de ${data.name}`}>
        <figure className="profile-photo">
          {data.portrait ? <img src={data.portrait} alt={data.portraitAlt || `Photo de ${data.name}`} width={1024} height={1024} fetchPriority="high" />
            : <div className="photo-placeholder" role="img" aria-label="Aucune photo">Pas de photo</div>}
        </figure>
        <div className="profile-copy">
          <section aria-labelledby="how-title">
            <div className="how-heading"><h2 id="how-title">Comment utiliser cette page</h2><Mascot pose="salut" size={64} /></div>
            <p>{data.howTo}</p>
          </section>
          <section className="how-to" aria-labelledby="about-title">
            <h2 id="about-title">À propos de moi</h2>
            <p>{data.about}</p>
          </section>
          <dl className="profile-details">
            <div><dt><Cake aria-hidden="true" />Date de naissance</dt><dd>{data.birthDate || "—"}</dd></div>
            <div><dt><MapPin aria-hidden="true" />Adresse</dt><dd>{data.address || "—"}</dd></div>
            <div className="last-updated"><dt><CalendarCheck aria-hidden="true" />Dernière mise à jour</dt><dd><time dateTime={data.updatedAtISO}>{data.updatedAt}</time></dd></div>
          </dl>
          <section className="passport-contact" aria-labelledby="contact-title">
            <h2 id="contact-title">Ma personne de contact</h2>
            <p>Pour m'aider, vous pouvez appeler :</p>
            {data.contactName && <p className="passport-contact-name">{data.contactName}{data.contactRelationship && `, ${data.contactRelationship}`}</p>}
            {data.contactPhone ? <Button asChild className="passport-contact-call">
              <a href={contactHref}><span>{contactFirstName ? `Appeler ${contactFirstName}` : "Appeler ma personne de contact"}</span><span>{data.contactPhone}</span></a>
            </Button> : <p>Aucun numéro renseigné.</p>}
          </section>
        </div>
      </section>
      {data.reminder && <aside className="communication-note"><Info aria-hidden="true" /><p>{data.reminder}</p></aside>}
      <Accordion type="multiple" className="passport-sections" aria-label="Les rubriques de mon passeport">
        <AccordionItem value="dictionary" className="passport-section">
          <SectionHeader title="Mon dictionnaire" icon={dictionaryIcon.url} />
          <AccordionContent className="section-content">
            {data.dictionary.length === 0 ? <p>Aucune entrée pour le moment.</p> :
              <div className="dictionary-grid">{data.dictionary.map(entry => <DictionaryCard key={entry.id} entry={entry} />)}</div>}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="interests" className="passport-section">
          <SectionHeader title="Mes centres d’intérêt" icon={interestsIcon.url} />
          <AccordionContent className="section-content"><TagList items={data.interests} /></AccordionContent>
        </AccordionItem>
        <AccordionItem value="dislikes" className="passport-section">
          <SectionHeader title="Mes peurs / Ce que je n’aime pas" icon={dislikesIcon.url} />
          <AccordionContent className="section-content"><TagList items={data.dislikes} /></AccordionContent>
        </AccordionItem>
        <AccordionItem value="other" className="passport-section">
          <SectionHeader title="Autres informations" icon={informationIcon.url} />
          <AccordionContent className="section-content"><BulletList items={data.additional} /></AccordionContent>
        </AccordionItem>
      </Accordion>
      <footer className="passport-footer">
        <p>Merci de prendre le temps de me comprendre.</p>
        {demo && <p>Profil fictif de démonstration · Coordonnées et médias donnés à titre d’exemple. <a href="/connexion">Espace professionnel</a></p>}
      </footer>
    </div>
  );
}
