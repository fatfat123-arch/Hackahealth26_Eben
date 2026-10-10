import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DictionaryGrid } from "@/components/passport/dictionary-grid";
import { PatientForm } from "@/components/backoffice/patient-form";
import { draftToRow, emptyDraft, rowToDraft, toViewData, type PatientRow, type PatientDraft } from "@/lib/patients";
import { moveDictionaryEntry } from "@/lib/dictionary-order";
import type { DictionaryEntry } from "@/data/passport";

beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const entries: DictionaryEntry[] = [
  { id: "one", title: "J’ai soif", type: "image", source: "/photo.jpg", alt: "Un verre", description: "Boire" },
  { id: "two", title: "Je suis fatigué", type: "video", source: "/video.webm", alt: "Fatigue", description: "Une pause" },
  { id: "three", title: "J’appelle", type: "audio", source: "/audio.mp3", alt: "Un appel", description: "Appeler" },
];

describe("Dictionary enlargement", () => {
  it("opens an entry, loops videos automatically, and closes", () => {
    render(<DictionaryGrid entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: "Agrandir : J’ai soif" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "J’ai soif" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Précédent" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Suivant" }));
    dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("video")).toHaveAttribute("autoplay");
    expect(dialog.querySelector("video")).toHaveAttribute("loop");
    expect(dialog.querySelector("video")).toHaveProperty("muted", true);
    expect(dialog.querySelector("video")).not.toHaveAttribute("controls");
    fireEvent.click(within(dialog).getByRole("button", { name: "Suivant" }));
    expect(dialog.querySelector("audio")).toHaveAttribute("controls");
    expect(dialog.querySelector("audio")).not.toHaveAttribute("autoplay");
    expect(within(dialog).getByRole("button", { name: "Suivant" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Dictionary order", () => {
  it("keeps existing order, moves without mutation, and survives persistence mappings", () => {
    const draft = emptyDraft();
    draft.dictionary = entries.map(e => ({ ...e, path: e.source }));
    expect(moveDictionaryEntry(draft.dictionary, 0, -1)).toBe(draft.dictionary);
    const moved = moveDictionaryEntry(draft.dictionary, 2, 0);
    expect(moved.map(e => e.id)).toEqual(["three", "one", "two"]);
    expect(draft.dictionary.map(e => e.id)).toEqual(["one", "two", "three"]);
    const saved = draftToRow({ ...draft, dictionary: moved });
    const row: PatientRow = { ...saved, id: "patient", updated_at: "2026-10-10T00:00:00Z" };
    const loaded = rowToDraft(row);
    expect(toViewData(loaded, {}, row.updated_at).dictionary.map(e => e.id)).toEqual(["three", "one", "two"]);
  });

  it("reorders with arrow buttons, numbers positions and appends new entries", () => {
    function Form() {
      const [draft, setDraft] = useState<PatientDraft>({ ...emptyDraft(), dictionary: entries.map(e => ({ ...e, path: e.source })) });
      return <PatientForm draft={draft} onChange={setDraft} urls={{}} onUrls={() => {}} readOnly={false} folder="test" updatedAt={null} />;
    }
    render(<Form />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Dictionnaire" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("button", { name: "Monter l’entrée 1" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Monter l’entrée 2" }));
    let groups = screen.getAllByRole("group", { name: /Entrée/ });
    const first = groups[0];
    if (!first) throw new Error("Première entrée manquante");
    expect(within(first).getByLabelText("Signification (titre)")).toHaveValue("Je suis fatigué");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une entrée" }));
    groups = screen.getAllByRole("group", { name: /Entrée/ });
    expect(groups).toHaveLength(4);
    const last = groups[3];
    if (!last) throw new Error("Nouvelle entrée manquante");
    expect(within(last).getByLabelText("Signification (titre)")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Descendre l’entrée 4" })).toBeDisabled();
  });
});
