import { CircleHelp, Heart, QrCode, Smile, type LucideIcon } from "lucide-react";

const poses: Record<"salut" | "joie" | "inquiete" | "qr", LucideIcon> = {
  salut: Smile,
  joie: Heart,
  inquiete: CircleHelp,
  qr: QrCode,
};
export type MascotPose = keyof typeof poses;

/** Decorative brand mark, hidden from screen readers. */
export function Mascot({ pose, size = 96, className = "" }: { pose: MascotPose; size?: number; className?: string }) {
  const Icon = poses[pose];
  return <span className={`mascot ${className}`} aria-hidden="true" style={{ width: size, height: size }}><Icon /></span>;
}

export function EmptyState({ text, children }: { text: string; children?: React.ReactNode }) {
  return <div className="bo-empty"><Mascot pose="salut" size={112} /><p>{text}</p>{children}</div>;
}
