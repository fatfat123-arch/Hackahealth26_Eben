import salut from "@/assets/mascotte-salut.png.asset.json";
import joie from "@/assets/mascotte-joie.png.asset.json";
import inquiete from "@/assets/mascotte-inquiete.png.asset.json";
import qr from "@/assets/mascotte-qr.png.asset.json";

const poses = { salut, joie, inquiete, qr } as const;
export type MascotPose = keyof typeof poses;

/** Decorative mascot — always on a white area, hidden from screen readers. */
export function Mascot({ pose, size = 96, className = "" }: { pose: MascotPose; size?: number; className?: string }) {
  return <img className={`mascot ${className}`} src={poses[pose].url} alt="" aria-hidden="true" width={size} height={size} loading="lazy" />;
}

export function EmptyState({ text, children }: { text: string; children?: React.ReactNode }) {
  return <div className="bo-empty"><Mascot pose="salut" size={112} /><p>{text}</p>{children}</div>;
}
