import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Heart, Info, MessageCircle, Shield, Plus, Minus } from "lucide-react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Accordion, AccordionItem, AccordionContent } from "@/components/ui/accordion";
import { DictionaryCard } from "@/components/passport/dictionary-card";
import { passport } from "@/data/passport";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [
    { title: "Passeport de communication — Julien Morel" },
    { name: "description", content: "Découvrez comment communiquer avec Julien : ses gestes, ses centres d’intérêt et ce qui est important pour lui." },
    { property: "og:title", content: "Passeport de communication — Julien Morel" },
    { property: "og:description", content: "Prendre le temps de comprendre Julien, ses gestes et ses besoins." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

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
  return <ul className="passport-list">{items.map(item => <li key={item}>{item}</li>)}</ul>;
}

function Index() {
  return (
    <div className="passport-page">
      <header className="passport-heading">
        <div className="heading-symbol" aria-hidden="true"><MessageCircle size={32} strokeWidth={1.6} /></div>
        <h1>Passeport de communication</h1>
        <div className="title-underline" />
      </header>
      <section className="profile-section" aria-label={`Profil de ${passport.name}`}>
        <figure className="profile-photo">
          <img src={passport.portrait} alt={passport.portraitAlt} width={1024} height={1024} fetchPriority="high" />
          <figcaption><span>{passport.name}</span><span>Heureux de vous rencontrer.</span></figcaption>
        </figure>
        <div className="profile-copy">
          <section aria-labelledby="how-title">
            <h2 id="how-title">Comment utiliser cette page</h2>
            <p>{passport.howTo}</p>
          </section>
          <section className="how-to" aria-labelledby="about-title">
            <h2 id="about-title">À propos de moi</h2>
            <p>{passport.about}</p>
          </section>
          <dl className="profile-details">
            <div><dt>Nom</dt><dd>{passport.name}</dd></div>
            <div><dt>Date de naissance</dt><dd>{passport.birthDate}</dd></div>
            <div><dt>Téléphone</dt><dd><a href={passport.phoneHref}>{passport.phone}</a><span className="contact-note">{passport.phoneNote}</span></dd></div>
            <div><dt>Adresse</dt><dd>{passport.address}</dd></div>
            <div className="last-updated"><dt>Dernière mise à jour</dt><dd><time dateTime={passport.updatedAtISO}>{passport.updatedAt}</time></dd></div>
          </dl>
        </div>
      </section>
      <aside className="communication-note"><Info aria-hidden="true" /><p>{passport.reminder}</p></aside>
      <Accordion type="multiple" className="passport-sections" aria-label="Les rubriques de mon passeport">
        <AccordionItem value="dictionary" className="passport-section">
          <SectionHeader title="Mon dictionnaire" icon={BookOpen} />
          <AccordionContent className="section-content">
            <div className="dictionary-grid">{passport.dictionary.map(entry => <DictionaryCard key={entry.id} entry={entry} />)}</div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="interests" className="passport-section">
          <SectionHeader title="Mes centres d’intérêt" icon={Heart} />
          <AccordionContent className="section-content"><BulletList items={passport.interests} /></AccordionContent>
        </AccordionItem>
        <AccordionItem value="dislikes" className="passport-section">
          <SectionHeader title="Mes peurs / Ce que je n’aime pas" icon={Shield} />
          <AccordionContent className="section-content"><BulletList items={passport.dislikes} /></AccordionContent>
        </AccordionItem>
        <AccordionItem value="other" className="passport-section">
          <SectionHeader title="Autres informations" icon={Info} />
          <AccordionContent className="section-content"><BulletList items={passport.additional} /></AccordionContent>
        </AccordionItem>
      </Accordion>
      <footer className="passport-footer">
        <p>Merci de prendre le temps de me comprendre.</p>
        <p>Profil fictif de démonstration · Coordonnées et médias donnés à titre d’exemple.</p>
      </footer>
    </div>
  );
}
