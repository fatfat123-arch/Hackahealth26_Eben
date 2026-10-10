import { useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from "lucide-react";
import { moveDictionaryEntry } from "@/lib/dictionary-order";
import { defaultSectionOrder, SECTION_TITLES, type SectionKey } from "@/lib/section-order";

function Item({ k, index, count, onMove }: { k: SectionKey; index: number; count: number; onMove: (f: number, t: number) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging, transform, transition } = useSortable({ id: k });
  const style = transform ? { transform: `translate3d(0, ${Math.round(transform.y)}px, 0)`, transition } : undefined;
  const t = SECTION_TITLES[k];
  return <li ref={setNodeRef} style={style} className={`bo-section-order-item${isDragging ? " is-dragging" : ""}`}>
    <button ref={setActivatorNodeRef} type="button" className="bo-btn bo-btn-outline bo-icon-btn bo-dict-handle" {...attributes} {...listeners} aria-label={`Déplacer la section ${t}`} title="Déplacer"><GripVertical aria-hidden="true" /></button>
    <span className="bo-section-order-num" aria-hidden="true">{index + 1}</span>
    <span className="bo-section-order-title">{t}</span>
    <span className="bo-section-order-ctl">
      <button type="button" className="bo-btn bo-btn-outline bo-icon-btn" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Monter la section ${t}`} title="Monter"><ArrowUp aria-hidden="true" /></button>
      <button type="button" className="bo-btn bo-btn-outline bo-icon-btn" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Descendre la section ${t}`} title="Descendre"><ArrowDown aria-hidden="true" /></button>
    </span>
  </li>;
}

export function SectionOrderEditor({ order, onChange }: { order: SectionKey[]; onChange: (o: SectionKey[]) => void }) {
  const [announce, setAnnounce] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function move(from: number, to: number) {
    const next = moveDictionaryEntry(order, from, to);
    if (next === order) return;
    onChange(next);
    setAnnounce(`${SECTION_TITLES[order[from]!]} déplacée à la position ${to + 1} sur ${next.length}.`);
  }
  return <div>
    <p className="bo-hint">Choisissez l’ordre d’affichage des sections sur le passeport. Les sections vides restent masquées.</p>
    <p className="sr-only" role="status">{announce}</p>
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      accessibility={{ screenReaderInstructions: { draggable: "Pour déplacer une section, appuyez sur Espace, utilisez les flèches, puis appuyez sur Espace pour confirmer ou Échap pour annuler." }, announcements: {
        onDragStart: () => "Déplacement de la section commencé.",
        onDragOver: ({ over }) => over ? `Position ${order.indexOf(over.id as SectionKey) + 1}.` : "Hors de la liste.",
        onDragEnd: () => "Déplacement terminé.", onDragCancel: () => "Déplacement annulé.",
      } }}
      onDragEnd={({ active, over }) => { if (over) move(order.indexOf(active.id as SectionKey), order.indexOf(over.id as SectionKey)); }}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="bo-section-order" aria-label="Ordre des sections">
          {order.map((k, i) => <Item key={k} k={k} index={i} count={order.length} onMove={move} />)}
        </ol>
      </SortableContext>
    </DndContext>
    <button type="button" className="bo-btn bo-btn-outline" onClick={() => { onChange(defaultSectionOrder()); setAnnounce("Ordre par défaut rétabli."); }}><RotateCcw aria-hidden="true" /> Rétablir l’ordre par défaut</button>
  </div>;
}
