import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "caregiver" }) => PromiseLike<{ data: boolean | null }> }; userId: string };

async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

export const createCaregiver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true, user_metadata: { full_name: data.name },
    });
    if (error || !created.user) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "weak_password") throw new Error("Ce mot de passe est trop facile à deviner ou a déjà fuité sur internet. Choisissez-en un autre.");
      if (code === "email_exists" || error?.message?.includes("already")) throw new Error("Cette adresse e-mail est déjà utilisée.");
      throw new Error("Impossible de créer le compte.");
    }
    await supabaseAdmin.from("profiles").upsert({ id: created.user.id, full_name: data.name, email: data.email });
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "caregiver" });
    if (roleErr) throw new Error("Le rôle n’a pas pu être attribué.");
    return { id: created.user.id };
  });

export const updateCaregiver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", data.id).eq("role", "caregiver").maybeSingle();
    if (!role) throw new Error("Accompagnant introuvable.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { email: data.email, email_confirm: true, user_metadata: { full_name: data.name } });
    if (error) throw new Error("Impossible de modifier l’adresse e-mail.");
    await supabaseAdmin.from("profiles").update({ full_name: data.name, email: data.email }).eq("id", data.id);
    return { ok: true };
  });
