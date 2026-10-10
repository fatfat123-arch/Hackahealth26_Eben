import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "caregiver" }) => PromiseLike<{ data: boolean | null }> }; userId: string };

async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Throws if the target is the caller, or if the change would leave no active admin. */
async function assertSafeTarget(context: Ctx, targetId: string, removesAdmin: boolean) {
  if (targetId === context.userId) throw new Error("Vous ne pouvez pas faire cette action sur votre propre compte.");
  const sb = await admin();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", targetId);
  if (!roles?.length) throw new Error("Compte introuvable.");
  const isAdmin = roles.some(r => r.role === "admin");
  if (removesAdmin && isAdmin) {
    const { data: admins } = await sb.from("user_roles").select("user_id").eq("role", "admin").neq("user_id", targetId);
    const ids = (admins ?? []).map(a => a.user_id);
    const { count } = ids.length ? await sb.from("profiles").select("id", { count: "exact", head: true }).in("id", ids).is("archived_at", null) : { count: 0 };
    if (!count) throw new Error("Il doit toujours rester au moins un administrateur actif.");
  }
  return sb;
}

const idInput = (d: unknown) => z.object({ id: z.string().uuid() }).parse(d);

export const createCaregiver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    role: z.enum(["caregiver", "admin"]).default("caregiver"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const supabaseAdmin = await admin();
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
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
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
    const supabaseAdmin = await admin();
    const { data: role } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", data.id).limit(1).maybeSingle();
    if (!role) throw new Error("Compte introuvable.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { email: data.email, email_confirm: true, user_metadata: { full_name: data.name } });
    if (error) throw new Error("Impossible de modifier l’adresse e-mail.");
    await supabaseAdmin.from("profiles").update({ full_name: data.name, email: data.email }).eq("id", data.id);
    return { ok: true };
  });

export const promoteToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const sb = await assertSafeTarget(context as unknown as Ctx, data.id, false);
    const { error } = await sb.from("user_roles").upsert({ user_id: data.id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error("Le rôle n’a pas pu être attribué.");
    await sb.from("user_roles").delete().eq("user_id", data.id).eq("role", "caregiver");
    return { ok: true };
  });

export const setAccountArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const sb = await assertSafeTarget(context as unknown as Ctx, data.id, data.archived);
    const { error } = await sb.auth.admin.updateUserById(data.id, { ban_duration: data.archived ? "876000h" : "none" });
    if (error) throw new Error("Le compte n’a pas pu être modifié.");
    await sb.from("profiles").update({ archived_at: data.archived ? new Date().toISOString() : null }).eq("id", data.id);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const sb = await assertSafeTarget(context as unknown as Ctx, data.id, true);
    // Patient profiles created by this account are kept (created_by is a plain id, no cascade).
    const { error } = await sb.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Le compte n’a pas pu être supprimé.");
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), password: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const sb = await assertSafeTarget(context as unknown as Ctx, data.id, false);
    const { error } = await sb.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) {
      if ((error as { code?: string }).code === "weak_password") throw new Error("Ce mot de passe est trop facile à deviner ou a déjà fuité sur internet. Choisissez-en un autre.");
      throw new Error("Le mot de passe n’a pas pu être modifié.");
    }
    return { ok: true };
  });
