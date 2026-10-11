import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth.functions";
import { db, iso } from "@/server/db.server";

type UserListRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "caregiver";
  created_at: Date | string;
  archived_at: Date | string | null;
};
type ProfileRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  created_at: Date | string;
};
type CreatedPatientRow = RowDataPacket & { id: string; name: string; updated_at: Date | string };

const admin = (user: { role: string }) => {
  if (user.role !== "admin") throw new Error("Accès réservé aux administrateurs.");
};
const idInput = (d: unknown) => z.object({ id: z.string().uuid() }).parse(d);
async function safe(caller: string, target: string, removesAdmin: boolean) {
  if (caller === target)
    throw new Error("Vous ne pouvez pas faire cette action sur votre propre compte.");
  const [rows] = await db().execute<(RowDataPacket & { role: string })[]>(
    "SELECT role FROM users WHERE id=?",
    [target],
  );
  if (!rows[0]) throw new Error("Compte introuvable.");
  if (removesAdmin && rows[0].role === "admin") {
    const [counts] = await db().execute<(RowDataPacket & { n: number })[]>(
      "SELECT COUNT(*) AS n FROM users WHERE role='admin' AND archived_at IS NULL AND id<>?",
      [target],
    );
    if (!Number(counts[0]?.n))
      throw new Error("Il doit toujours rester au moins un administrateur actif.");
  }
}

export const listCaregivers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    admin(context.user);
    const [rows] = await db().query<UserListRow[]>(
      "SELECT id,full_name,email,role,created_at,archived_at FROM users ORDER BY full_name",
    );
    return rows.map((r) => ({
      ...r,
      isAdmin: r.role === "admin",
      created_at: iso(r.created_at),
      archived_at: iso(r.archived_at),
    }));
  });
export const getCaregiver = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((v: unknown) => z.string().uuid().parse(v))
  .handler(async ({ data, context }) => {
    admin(context.user);
    const [[profiles], [patients]] = await Promise.all([
      db().execute<ProfileRow[]>("SELECT id,full_name,email,created_at FROM users WHERE id=?", [
        data,
      ]),
      db().execute<CreatedPatientRow[]>(
        "SELECT id,name,updated_at FROM patients WHERE created_by=? ORDER BY name",
        [data],
      ),
    ]);
    return {
      profile: profiles[0] ? { ...profiles[0], created_at: iso(profiles[0].created_at) } : null,
      patients: patients.map((p) => ({ ...p, updated_at: iso(p.updated_at) })),
    };
  });
export const createCaregiver = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128),
        role: z.enum(["caregiver", "admin"]).default("caregiver"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    admin(context.user);
    try {
      const id = randomUUID();
      await db().execute(
        "INSERT INTO users (id,email,full_name,password_hash,role) VALUES (?,?,?,?,?)",
        [id, data.email.toLowerCase(), data.name, await hash(data.password, 12), data.role],
      );
      return { id };
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY")
        throw new Error("Cette adresse e-mail est déjà utilisée.");
      throw new Error("Impossible de créer le compte.");
    }
  });
export const updateCaregiver = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    admin(context.user);
    await db().execute("UPDATE users SET full_name=?,email=? WHERE id=?", [
      data.name,
      data.email.toLowerCase(),
      data.id,
    ]);
    return { ok: true };
  });
export const promoteToAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    admin(context.user);
    await safe(context.user.id, data.id, false);
    await db().execute("UPDATE users SET role='admin' WHERE id=?", [data.id]);
    return { ok: true };
  });
export const setAccountArchived = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    admin(context.user);
    await safe(context.user.id, data.id, data.archived);
    await db().execute("UPDATE users SET archived_at=? WHERE id=?", [
      data.archived ? new Date() : null,
      data.id,
    ]);
    if (data.archived) await db().execute("DELETE FROM sessions WHERE user_id=?", [data.id]);
    return { ok: true };
  });
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    admin(context.user);
    await safe(context.user.id, data.id, true);
    await db().execute("DELETE FROM users WHERE id=?", [data.id]);
    return { ok: true };
  });
export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(128) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    admin(context.user);
    await safe(context.user.id, data.id, false);
    await db().execute("UPDATE users SET password_hash=? WHERE id=?", [
      await hash(data.password, 12),
      data.id,
    ]);
    await db().execute("DELETE FROM sessions WHERE user_id=?", [data.id]);
    return { ok: true };
  });
