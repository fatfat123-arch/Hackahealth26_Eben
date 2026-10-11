import { compare } from "bcryptjs";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createSession, currentUser, destroySession, publicUser } from "@/server/auth.server";
import {
  assertPersistentLoginRateLimit,
  recordPersistentFailedLogin,
  resetPersistentLoginRateLimit,
} from "@/server/login-rate-limit.server";
import { clientIp } from "@/server/swiss-ip";
import { db } from "@/server/db.server";
import type { DbUser } from "@/server/db.server";
import type { RowDataPacket } from "mysql2";

// Keep unknown-account and known-account password checks computationally equivalent.
const DUMMY_PASSWORD_HASH = "$2b$12$KEGWWxFwFMP7k/B03JAgquT00jbgrQkFfJ1jWUPeHiXr6g3y2Qy/6";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await currentUser();
  if (!user || user.archived_at) throw new Error("Session expirée. Veuillez vous reconnecter.");
  return next({ context: { user } });
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).parse(v),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const address = clientIp(getRequest());
    const limitKeys = address ? [`email:${email}`, `ip:${address}`] : [`email:${email}`];
    await assertPersistentLoginRateLimit(limitKeys);
    const [rows] = await db().execute<(DbUser & RowDataPacket)[]>(
      "SELECT * FROM users WHERE email=? LIMIT 1",
      [email],
    );
    const user = rows[0];
    const passwordMatches = await compare(
      data.password,
      user?.password_hash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || user.archived_at || !passwordMatches) {
      await recordPersistentFailedLogin(limitKeys);
      console.warn("Failed login attempt");
      throw new Error("Adresse e-mail ou mot de passe incorrect.");
    }
    await Promise.all(limitKeys.map((limitKey) => resetPersistentLoginRateLimit(limitKey)));
    await createSession(user.id);
    return publicUser(user);
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  return user && !user.archived_at ? publicUser(user) : null;
});
