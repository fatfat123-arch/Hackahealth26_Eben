import { compare } from "bcryptjs";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSession, currentUser, destroySession, publicUser } from "@/server/auth.server";
import { db } from "@/server/db.server";
import type { DbUser } from "@/server/db.server";
import type { RowDataPacket } from "mysql2";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await currentUser();
  if (!user || user.archived_at) throw new Error("Session expirée. Veuillez vous reconnecter.");
  return next({ context: { user } });
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).parse(v))
  .handler(async ({ data }) => {
    const [rows] = await db().execute<(DbUser & RowDataPacket)[]>("SELECT * FROM users WHERE email=? LIMIT 1", [data.email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || user.archived_at || !(await compare(data.password, user.password_hash))) throw new Error("Adresse e-mail ou mot de passe incorrect.");
    await createSession(user.id);
    return publicUser(user);
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => { await destroySession(); return { ok: true }; });
export const getMe = createServerFn({ method: "GET" }).handler(async () => { const user = await currentUser(); return user && !user.archived_at ? publicUser(user) : null; });
