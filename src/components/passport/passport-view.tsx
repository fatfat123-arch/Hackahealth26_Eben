import { BookOpen, Heart, Info, MessageCircle, Shield, Plus, Minus } from "lucide-react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Accordion, AccordionItem, AccordionContent } from "@/components/ui/accordion";
import { DictionaryCard } from "@/components/passport/dictionary-card";
import type { DictionaryEntry } from "@/data/passport";

export type PassportViewData = {
  name: string;
  birthDate: string;
  phone: string;
  phoneHref: string;
  phoneNote: string;
  address: string;
  updatedAt: string;
  updatedAtISO: string;
  portrait?: string | null;
  portraitAlt: string;
  about: string;
  howTo: string;
  reminder: string;
  dictionary: DictionaryEntry[];
  interests: string[];
  dislikes: string[];
  additional: string[];
};

function SectionHeader({ title, icon: Icon }: { title: string; icon: typeof BookOpen }) {
  return <AccordionPrimitive.Header asChild>
    <h2>
      <AccordionPrimitive.Trigger className="passport-trigger">
        <span className="section-title"><Icon aria-hidden="true" /><span>{title}</span></span>
        <span className="section-toggle" aria-hidden="true"><Plus className="closed-icon" /><Minus className="open-icon" /></span>
      </AccordionPrimitive.Trigger>
    </h2>
  </AccordionPrimitive.Header>;
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <p>Aucune information pour le moment.</p>;
  return <ul className="passport-list">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

export function PassportView({ data, demo = false }: { data: PassportViewData; demo?: boolean }) {
  return (
    <div className="passport-page">
      <header className="passport-heading">
        <div className="heading-symbol" aria-hidden="true"><MessageCircle size={32} strokeWidth={1.6} /></div>
        <h1>Passeport de communication</h1>
        <div className="title-underline" />
      </header>
      <section className="profile-section" aria-label={`Profil de ${data.name}`}>
        <figure className="profile-photo">
          {data.portrait ? <img src={data.portrait} alt={data.portraitAlt || `Photo de ${data.name}`} width={1024} height={1024} fetchPriority="high" />
            : <div className="photo-placeholder" role="img" aria-label="Aucune photo">Pas de photo</div>}
          <figcaption><span>{data.name}</span><span>Heureux de vous rencontrer.</span></figcaption>
        </figure>
        <div className="profile-copy">
          <section aria-labelledby="how-title">
            <h2 id="how-title">Comment utiliser cette page</h2>
            <p>{data.howTo}</p>
          </section>
          <section className="how-to" aria-labelledby="about-title">
            <h2 id="about-title">À propos de moi</h2>
            <p>{data.about}</p>
          </section>
          <dl className="profile-details">
            <div><dt>Nom</dt><dd>{data.name}</dd></div>
            <div><dt>Date de naissance</dt><dd>{data.birthDate}</dd></div>
            <div><dt>Téléphone</dt><dd>{data.phone ? <a href={data.phoneHref}>{data.phone}</a> : "—"}{data.phoneNote && <span className="contact-note">{data.phoneNote}</span>}</dd></div>
            <div><dt>Adresse</dt><dd>{data.address}</dd></div>
            <div className="last-updated"><dt>Dernière mise à jour</dt><dd><time dateTime={data.updatedAtISO}>{data.updatedAt}</time></dd></div>
          </dl>
        </div>
      </section>
      {data.reminder && <aside className="communication-note"><Info aria-hidden="true" /><p>{data.reminder}</p></aside>}
      <Accordion type="multiple" className="passport-sections" aria-label="Les rubriques de mon passeport">
        <AccordionItem value="dictionary" className="passport-section">
          <SectionHeader title="Mon dictionnaire" icon={BookOpen} />
          <AccordionContent className="section-content">
            {data.dictionary.length === 0 ? <p>Aucune entrée pour le moment.</p> :
              <div className="dictionary-grid">{data.dictionary.map(entry => <DictionaryCard key={entry.id} entry={entry} />)}</div>}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="interests" className="passport-section">
          <SectionHeader title="Mes centres d’intérêt" icon={Heart} />
          <AccordionContent className="section-content"><BulletList items={data.interests} /></AccordionContent>
        </AccordionItem>
        <AccordionItem value="dislikes" className="passport-section">
          <SectionHeader title="Mes peurs / Ce que je n’aime pas" icon={Shield} />
          <AccordionContent className="section-content"><BulletList items={data.dislikes} /></AccordionContent>
        </AccordionItem>
        <AccordionItem value="other" className="passport-section">
          <SectionHeader title="Autres informations" icon={Info} />
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
