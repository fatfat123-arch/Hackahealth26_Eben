import type { CSSProperties } from "react";
import iconSheet from "@/assets/icones-navigation.png";

export type NavigationIconName = "patient" | "accompagnants" | "liste" | "ajouter";

const positions: Record<NavigationIconName, readonly [column: number, row: number]> = {
  patient: [5, 0],
  accompagnants: [6, 0],
  liste: [0, 1],
  ajouter: [1, 1],
};

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const [column, row] = positions[name];
  const style = {
    "--icon-column": column,
    "--icon-row": row,
  } as CSSProperties;

  return (
    <span className="navigation-icon" style={style} aria-hidden="true">
      <img src={iconSheet} alt="" />
    </span>
  );
}
