import { ImageIcon, Play, Volume2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DictionaryMedia } from "@/components/passport/dictionary-media";
import type { DictionaryEntry } from "@/data/passport";

export function DictionaryCard({ entry, onOpen, suspended = false }: { entry: DictionaryEntry; onOpen?: () => void; suspended?: boolean }) {
  return (
    <article className={`dictionary-card${onOpen ? " dictionary-card-openable" : ""}`} onClick={event => {
      if (event.target instanceof Element && !event.target.closest("button, video, audio")) onOpen?.();
    }}>
      <div className="dictionary-media-wrap">
        <DictionaryMedia entry={entry} suspended={suspended} />
        {onOpen && <Button type="button" variant="secondary" size="icon" className="dictionary-expand" onClick={onOpen} aria-label={`Agrandir : ${entry.title || "Entrée du dictionnaire"}`} title="Agrandir"><Maximize2 aria-hidden="true" /></Button>}
      </div>
      <div className="dictionary-copy">
        <p className="media-kind">{entry.type === "audio" ? <Volume2 aria-hidden="true" /> : entry.type === "image" ? <ImageIcon aria-hidden="true" /> : <Play aria-hidden="true" />}{({ image: "Photo", gif: "Image animée", video: "Vidéo", audio: "Son" })[entry.type]}</p>
        <h3>{onOpen ? <Button type="button" variant="link" className="dictionary-title-button" onClick={onOpen}>{entry.title || "Entrée du dictionnaire"}</Button> : entry.title}</h3>
        <p>{entry.description}</p>
        {entry.transcript && <p className="audio-transcript">{entry.transcript}</p>}
      </div>
    </article>
  );
}