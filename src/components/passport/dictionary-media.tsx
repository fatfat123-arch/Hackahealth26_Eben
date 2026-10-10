import { useEffect, useRef, useState } from "react";
import { AudioLines, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DictionaryEntry } from "@/data/passport";

export function DictionaryMedia({ entry, enlarged = false, suspended = false }: { entry: DictionaryEntry; enlarged?: boolean; suspended?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const still = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (entry.type === "gif") setPlaying(!suspended && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (suspended) { audio.current?.pause(); video.current?.pause(); }
  }, [entry.type, suspended]);

  function captureStill() {
    const img = image.current;
    const canvas = still.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
  }

  async function toggleAudio() {
    const element = audio.current;
    if (!element) return;
    if (playing) element.pause();
    else { try { await element.play(); setError(false); } catch { setError(true); } }
  }

  return <div className={`dictionary-media${enlarged ? " dictionary-media-large" : ""}`}>
    {entry.type === "image" && <img src={entry.source} alt={entry.alt} width={640} height={640} loading="lazy" />}
    {entry.type === "gif" && <>
      <img ref={image} src={!playing && entry.poster ? entry.poster : entry.source} alt={entry.alt} width={400} height={400} onLoad={captureStill} hidden={!playing && !entry.poster} />
      {!entry.poster && <canvas ref={still} role="img" aria-label={entry.alt} hidden={playing} />}
      <Button type="button" variant="secondary" size="icon" className="gif-control" disabled={suspended} onClick={() => { if (playing) captureStill(); setPlaying(!playing); }} aria-label={playing ? "Mettre l’image animée en pause" : "Lire l’image animée"} title={playing ? "Mettre en pause" : "Lire l’animation"}>
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
    </>}
    {entry.type === "video" && <video ref={video} controls playsInline preload="metadata" poster={entry.poster} aria-label={entry.alt}>
      <source src={entry.source} />Votre navigateur ne permet pas de lire cette vidéo.
    </video>}
    {entry.type === "audio" && <div className="audio-media">
      <AudioLines size={enlarged ? 96 : 56} strokeWidth={1.3} aria-hidden="true" />
      {enlarged ? <audio controls preload="metadata" src={entry.source} aria-label={entry.alt} /> : <>
        <Button type="button" variant="outline" className="audio-control" disabled={suspended} onClick={toggleAudio} aria-label={playing ? "Mettre le son en pause" : "Écouter le son"}>
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{playing ? "Pause" : "Écouter"}
        </Button>
        <audio ref={audio} preload="metadata" src={entry.source} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      </>}
      {error && <p role="alert">Le son est indisponible.</p>}
    </div>}
  </div>;
}
