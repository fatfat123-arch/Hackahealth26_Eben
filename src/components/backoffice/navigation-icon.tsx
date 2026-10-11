import type { CSSProperties } from "react";
import iconSheet from "@/assets/icones-navigation.png";

export type NavigationIconName =
  | "patient"
  | "accompagnants"
  | "liste"
  | "ajouter"
  | "info"
  | "idee"
  | "objectif"
  | "etoile"
  | "coeur"
  | "plante"
  | "sourire"
  | "ecoute"
  | "message"
  | "aide"
  | "maison"
  | "notes";

const positions: Record<NavigationIconName, readonly [column: number, row: number]> = {
  patient: [5, 0],
  accompagnants: [6, 0],
  liste: [0, 1],
  ajouter: [1, 1],
  info: [1, 0],
  idee: [2, 0],
  objectif: [3, 1],
  etoile: [4, 1],
  coeur: [5, 1],
  plante: [6, 1],
  sourire: [1, 2],
  ecoute: [2, 2],
  message: [3, 2],
  aide: [1, 3],
  maison: [4, 3],
  notes: [3, 3],
};

export function NavigationIcon({
  name,
  className = "",
}: {
  name: NavigationIconName;
  className?: string;
}) {
  const [column, row] = positions[name];
  const style = {
    "--icon-column": column,
    "--icon-row": row,
  } as CSSProperties;

  return (
    <span className={`navigation-icon ${className}`.trim()} style={style} aria-hidden="true">
      <img src={iconSheet} alt="" />
    </span>
  );
}
