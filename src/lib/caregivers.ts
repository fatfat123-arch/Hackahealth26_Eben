import { redirect } from "@tanstack/react-router";
import type { Me } from "@/lib/session";

export function requireAdmin(me: Me) {
  if (!me.isAdmin) throw redirect({ to: "/espace/patients" });
}
