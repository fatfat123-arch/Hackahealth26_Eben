import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SortableDictionaryEntry({
  id,
  index,
  count,
  title,
  onMove,
  children,
}: {
  id: string;
  index: number;
  count: number;
  title: string;
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({
    id,
  });
  return (
    <fieldset
      ref={setNodeRef}
      className={`bo-fieldset bo-dict-item${isDragging ? " bo-dict-dragging" : ""}`}
    >
      <legend>{title}</legend>
      <div className="bo-dict-order">
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="outline"
          size="icon"
          className="bo-btn bo-btn-outline bo-icon-btn bo-dict-handle"
          {...attributes}
          {...listeners}
          aria-label={`Déplacer l’entrée ${index + 1}`}
          title="Déplacer l’entrée"
        >
          <GripVertical aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bo-btn bo-btn-outline bo-icon-btn"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          aria-label={`Monter l’entrée ${index + 1}`}
          title="Monter"
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bo-btn bo-btn-outline bo-icon-btn"
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
          aria-label={`Descendre l’entrée ${index + 1}`}
          title="Descendre"
        >
          <ArrowDown aria-hidden="true" />
        </Button>
      </div>
      {children}
    </fieldset>
  );
}
