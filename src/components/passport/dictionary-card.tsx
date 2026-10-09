import { useEffect, useRef, useState } from "react";
import { AudioLines, ImageIcon, Pause, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DictionaryEntry } from "@/data/passport";

export function DictionaryCard({ entry }: { entry: DictionaryEntry }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (entry.type === "gif") setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [entry.type]);

  async function toggleAudio() {
    const element = audio.current;
    if (!element) return;
    if (playing) element.pause();
    else {
      try { await element.play(); setError(false); }
      catch { setError(true); }
    }
  }

  return (
    <article className="dictionary-card">
      <div className="dictionary-media">
        {entry.type === "image" && <img src={entry.source} alt={entry.alt} width={640} height={640} loading="lazy" />}
        {entry.type === "gif" && <>
          <img src={playing ? entry.source : entry.poster} alt={entry.alt} width={400} height={400} loading="lazy" />
          <Button variant="secondary" size="icon" className="gif-control" onClick={() => setPlaying(!playing)} aria-label={playing ? "Mettre l’image animée en pause" : "Lire l’image animée"} title={playing ? "Mettre en pause" : "Lire l’animation"}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
        </>}
        {entry.type === "video" && <video controls playsInline preload="none" poster={entry.poster} aria-label={entry.alt}>
          <source src={entry.source} type="video/mp4" />
          Votre navigateur ne permet pas de lire cette vidéo.
        </video>}
        {entry.type === "audio" && <div className="audio-media">
          <AudioLines size={56} strokeWidth={1.3} aria-hidden="true" />
          <Button variant="outline" className="audio-control" onClick={toggleAudio} aria-label={playing ? "Mettre le son en pause" : "Écouter le son"}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {playing ? "Pause" : "Écouter"}
          </Button>
          <audio ref={audio} preload="metadata" src={entry.source} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
          {error && <p role="alert">Le son est indisponible.</p>}
        </div>}
      </div>
      <div className="dictionary-copy">
        <p className="media-kind">{entry.type === "audio" ? <Volume2 aria-hidden="true" /> : entry.type === "image" ? <ImageIcon aria-hidden="true" /> : <Play aria-hidden="true" />}{({ image: "Photo", gif: "Image animée", video: "Vidéo", audio: "Son" })[entry.type]}</p>
        <h3>{entry.title}</h3>
        <p>{entry.description}</p>
        {entry.transcript && <p className="audio-transcript">{entry.transcript}</p>}
      </div>
    </article>
  );
}