import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DictionaryCard } from "@/components/passport/dictionary-card";
import { DictionaryMedia } from "@/components/passport/dictionary-media";
import type { DictionaryEntry } from "@/lib/dictionary-entry";

export function DictionaryGrid({ entries }: { entries: DictionaryEntry[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const entry = selected === null ? undefined : entries[selected];
  return (
    <Dialog.Root
      open={!!entry}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
    >
      <div className="dictionary-grid">
        {entries.map((item, index) => (
          <DictionaryCard
            key={item.id}
            entry={item}
            suspended={selected !== null}
            onOpen={() => {
              origin.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setSelected(index);
            }}
          />
        ))}
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="dictionary-overlay" />
        <Dialog.Content
          className="dictionary-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            origin.current?.focus();
          }}
        >
          {entry && (
            <>
              <div className="dictionary-dialog-top">
                <span aria-live="polite">
                  {(selected ?? 0) + 1} / {entries.length}
                </span>
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" className="bo-btn bo-btn-outline">
                    <X aria-hidden="true" />
                    Fermer
                  </Button>
                </Dialog.Close>
              </div>
              <div className="dictionary-dialog-body" key={entry.id}>
                <DictionaryMedia entry={entry} enlarged />
                <Dialog.Title className="dictionary-dialog-title">
                  {entry.title || "Entrée du dictionnaire"}
                </Dialog.Title>
                <Dialog.Description className="dictionary-dialog-description">
                  {entry.description || entry.alt || "Média du dictionnaire."}
                </Dialog.Description>
                {entry.transcript && (
                  <p className="dictionary-dialog-transcript">{entry.transcript}</p>
                )}
              </div>
              <nav className="dictionary-dialog-nav" aria-label="Navigation du dictionnaire">
                <Button
                  type="button"
                  variant="outline"
                  className="bo-btn bo-btn-outline"
                  disabled={selected === 0}
                  onClick={() =>
                    setSelected((index) => (index === null ? null : Math.max(0, index - 1)))
                  }
                >
                  <ArrowLeft aria-hidden="true" />
                  Précédent
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="bo-btn bo-btn-outline"
                  disabled={selected === entries.length - 1}
                  onClick={() =>
                    setSelected((index) =>
                      index === null ? null : Math.min(entries.length - 1, index + 1),
                    )
                  }
                >
                  Suivant
                  <ArrowRight aria-hidden="true" />
                </Button>
              </nav>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
