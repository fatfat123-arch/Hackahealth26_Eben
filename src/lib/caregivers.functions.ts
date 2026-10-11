import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth.functions";
import { db, iso } from "@/server/db.server";
import { currentSessionHash } from "@/server/auth.server";
import {
  changeUserRole,
  guardAccountRemoval,
  withAccountTransaction,
} from "@/server/user-roles.server";
import { clientIp } from "@/server/swiss-ip";
import {
  createCaregiverSchema,
  updateCaregiverSchema,
  parseRoleChangeInput,
} from "./user-role-input";

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
  role: "admin" | "caregiver";
  archived_at: Date | string | null;
};
type CreatedPatientRow = RowDataPacket & { id: string; name: string; updated_at: Date | string };

const admin = (user: { role: string }) => {
  if (user.role !== "admin") throw new Error("Accès réservé aux administrateurs.");
};
const idInput = (d: unknown) => z.object({ id: z.string().uuid() }).strict().parse(d);

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
      db().execute<ProfileRow[]>(
        "SELECT id,full_name,email,role,created_at,archived_at FROM users WHERE id=?",
        [data],
      ),
      db().execute<CreatedPatientRow[]>(
        "SELECT id,name,updated_at FROM patients WHERE created_by=? ORDER BY name",
        [data],
      ),
    ]);
    return {
      profile: profiles[0]
        ? {
            ...profiles[0],
            created_at: iso(profiles[0].created_at),
            archived_at: iso(profiles[0].archived_at),
          }
        : null,
      patients: patients.map((p) => ({ ...p, updated_at: iso(p.updated_at) })),
    };
  });
export const createCaregiver = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => createCaregiverSchema.parse(d))
  .handler(async ({ data, context }) => {
    admin(context.user);
    try {
      const id = randomUUID();
      const passwordHash = await hash(data.password, 12);
      await withAccountTransaction(currentSessionHash(), async (connection) => {
        await connection.execute(
          "INSERT INTO users (id,email,full_name,password_hash) VALUES (?,?,?,?)",
          [id, data.email.toLowerCase(), data.name, passwordHash],
        );
      });
      return { id };
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY")
        throw new Error("Cette adresse e-mail est déjà utilisée.");
      throw new Error("Impossible de créer le compte.");
    }
  });
export const updateCaregiver = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => updateCaregiverSchema.parse(d))
  .handler(async ({ data, context }) => {
    admin(context.user);
    await withAccountTransaction(currentSessionHash(), async (connection) => {
      await connection.execute("UPDATE users SET full_name=?,email=? WHERE id=?", [
        data.name,
        data.email.toLowerCase(),
        data.id,
      ]);
    });
    return { ok: true };
  });
export const changeCaregiverRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(parseRoleChangeInput)
  .handler(async ({ data, context }) => {
    const request = getRequest();
    const agent = request.headers.get("user-agent");
    return changeUserRole(currentSessionHash(), context.user.id, data, {
      ip: clientIp(request),
      userAgent: agent
        ? Array.from(agent)
            .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
            .join("")
            .slice(0, 512)
        : null,
    });
  });
export const setAccountArchived = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).strict().parse(d),
  )
  .handler(async ({ data, context }) => {
    admin(context.user);
    await withAccountTransaction(currentSessionHash(), async (connection, actor) => {
      await guardAccountRemoval(connection, actor, data.id, data.archived);
      await connection.execute("UPDATE users SET archived_at=IF(?,NOW(3),NULL) WHERE id=?", [
        data.archived,
        data.id,
      ]);
      if (data.archived)
        await connection.execute("DELETE FROM sessions WHERE user_id=?", [data.id]);
    });
    return { ok: true };
  });
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    admin(context.user);
    await withAccountTransaction(currentSessionHash(), async (connection, actor) => {
      await guardAccountRemoval(connection, actor, data.id, true);
      await connection.execute("DELETE FROM users WHERE id=?", [data.id]);
    });
    return { ok: true };
  });
export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), password: z.string().min(8).max(128) })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    admin(context.user);
    const passwordHash = await hash(data.password, 12);
    await withAccountTransaction(currentSessionHash(), async (connection, actor) => {
      await guardAccountRemoval(connection, actor, data.id, false);
      await connection.execute("UPDATE users SET password_hash=? WHERE id=?", [
        passwordHash,
        data.id,
      ]);
      await connection.execute("DELETE FROM sessions WHERE user_id=?", [data.id]);
    });
    return { ok: true };
  });
