import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TutorialPhoto = {
  src: string;
  alt: string;
  title?: string;
  explanation?: string;
  highlight?: { cx: number; cy: number; rx: number; ry: number };
};

function Photo({ photo }: { photo: TutorialPhoto }) {
  return (
    <span className="bo-tutorial-photo-image">
      <img src={photo.src} alt={photo.alt} />
      {photo.highlight && (
        <svg
          className="bo-tutorial-highlight"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <ellipse {...photo.highlight} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </span>
  );
}

export function TutorialPhotos({ photos }: { photos: TutorialPhoto[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const photo = selected === null ? undefined : photos[selected];
  return (
    <Dialog.Root
      open={photo !== undefined}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
    >
      <div className="bo-tutorial-photos">
        {photos.map((item, index) => (
          <figure className="bo-tutorial-photo-step" key={item.src}>
            <Button
              type="button"
              variant="ghost"
              className="bo-tutorial-photo-button"
              aria-label={`Agrandir la photo ${index + 1} : ${item.alt}`}
              onClick={(event) => {
                origin.current = event.currentTarget;
                setSelected(index);
              }}
            >
              <Photo photo={item} />
            </Button>
            {(item.title || item.explanation) && (
              <figcaption>
                {item.title && <strong>{item.title}</strong>}
                {item.explanation && <span>{item.explanation}</span>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="bo-tutorial-photo-overlay" />
        <Dialog.Content
          className="bo-tutorial-photo-dialog"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            origin.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">
            Photo {(selected ?? 0) + 1} du tutoriel NFC
          </Dialog.Title>
          <Dialog.Close asChild>
            <Button
              type="button"
              variant="outline"
              className="bo-btn bo-btn-outline bo-tutorial-photo-close"
            >
              <X aria-hidden="true" />
              Fermer
            </Button>
          </Dialog.Close>
          {photo && <Photo photo={photo} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
