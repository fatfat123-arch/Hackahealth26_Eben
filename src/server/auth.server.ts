import { createHash, randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { db, iso, type DbUser } from "@/server/db.server";

const COOKIE = "eh_session";
const DAYS = 14;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export function setSessionCookie(token: string) {
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export function clearSessionCookie() {
  deleteCookie(COOKIE, { path: "/" });
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db().execute<ResultSetHeader>(
    "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL ? DAY))",
    [digest(token), userId, DAYS],
  );
  setSessionCookie(token);
}

export async function sessionUserFromToken(token?: string | null): Promise<DbUser | null> {
  if (!token) return null;
  const [rows] = await db().execute<(DbUser & RowDataPacket)[]>(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() LIMIT 1",
    [digest(token)],
  );
  return rows[0] ?? null;
}

export async function currentUser() {
  return sessionUserFromToken(getCookie(COOKIE));
}

export async function destroySession() {
  const token = getCookie(COOKIE);
  if (token) await db().execute("DELETE FROM sessions WHERE token_hash=?", [digest(token)]);
  clearSessionCookie();
}

export function publicUser(user: DbUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.full_name,
    isAdmin: user.role === "admin",
    isStaff: !user.archived_at,
    created_at: iso(user.created_at),
  };
}
