import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { db, type DbUser } from "./db.server";
import type { RoleChangeInput } from "@/lib/user-role-input";

const messages: Record<string, string> = {
  ROLE_FORBIDDEN:
    "Accès réservé aux administrateurs. Veuillez vous reconnecter si vos droits ont changé.",
  ROLE_REAUTH_REQUIRED: "Votre session ou votre mot de passe a changé. Veuillez vous reconnecter.",
  ROLE_REAUTH_FAILED: "Votre mot de passe est incorrect. Le rôle n’a pas été modifié.",
  ROLE_RATE_LIMITED: "Trop de tentatives. Réessayez dans quinze minutes.",
  ROLE_INVALID: "Le changement de rôle demandé est invalide.",
  ROLE_SELF_CHANGE: "Vous ne pouvez pas modifier votre propre rôle.",
  ROLE_TARGET_UNAVAILABLE: "Ce compte est introuvable ou archivé.",
  ROLE_STALE:
    "Le rôle a changé depuis l’ouverture de la page. Actualisez la page avant de réessayer.",
  ROLE_LAST_ADMIN: "Il doit toujours rester au moins un administrateur actif.",
  ROLE_SECURITY_UNAVAILABLE:
    "La gestion sécurisée des rôles n’est pas disponible. Contactez le responsable du site.",
  ROLE_DATABASE_FAILURE:
    "Le changement de rôle n’a pas pu être confirmé. Actualisez la page avant de réessayer.",
};
export class RoleSecurityError extends Error {
  constructor(public readonly reason: string) {
    super(messages[reason] ?? messages["ROLE_DATABASE_FAILURE"]);
  }
}

/** All account removals and role changes share this InnoDB lock and lock order. */
export async function withAccountTransaction<T>(
  sessionHash: string | null,
  action: (connection: PoolConnection, actor: DbUser) => Promise<T>,
): Promise<T> {
  if (!sessionHash) throw new RoleSecurityError("ROLE_FORBIDDEN");
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [lock] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM account_security_lock WHERE id=1 FOR UPDATE",
    );
    if (!lock.length) throw new RoleSecurityError("ROLE_SECURITY_UNAVAILABLE");
    const [actors] = await connection.execute<(DbUser & RowDataPacket)[]>(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW(3) AND u.archived_at IS NULL LIMIT 1 FOR UPDATE",
      [sessionHash],
    );
    const actor = actors[0];
    if (!actor || actor.role !== "admin") throw new RoleSecurityError("ROLE_FORBIDDEN");
    const result = await action(connection, actor);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function guardAccountRemoval(
  connection: PoolConnection,
  actor: DbUser,
  targetId: string,
  removesActiveAdmin: boolean,
) {
  if (actor.id === targetId)
    throw new Error("Vous ne pouvez pas faire cette action sur votre propre compte.");
  const [targets] = await connection.execute<(DbUser & RowDataPacket)[]>(
    "SELECT * FROM users WHERE id=? FOR UPDATE",
    [targetId],
  );
  const target = targets[0];
  if (!target) throw new Error("Compte introuvable.");
  if (removesActiveAdmin && target.role === "admin" && !target.archived_at) {
    const [counts] = await connection.execute<(RowDataPacket & { n: number })[]>(
      "SELECT COUNT(*) AS n FROM users WHERE role='admin' AND archived_at IS NULL",
      [],
    );
    if (Number(counts[0]?.n) <= 1) throw new RoleSecurityError("ROLE_LAST_ADMIN");
  }
  return target;
}

export type RoleRequestMetadata = { ip: string | null; userAgent: string | null };

/** Password proof is fresh for this action, checked on the server, never persisted. */
async function reauthenticate(sessionHash: string | null, password: string) {
  const proof = await withAccountTransaction(sessionHash, async (connection, actor) => {
    await connection.execute(
      "INSERT INTO role_reauthentication (user_id,failures,window_start) VALUES (?,0,NOW(3)) ON DUPLICATE KEY UPDATE failures=IF(window_start<DATE_SUB(NOW(3),INTERVAL 15 MINUTE),0,failures), window_start=IF(window_start<DATE_SUB(NOW(3),INTERVAL 15 MINUTE),NOW(3),window_start)",
      [actor.id],
    );
    const [attempts] = await connection.execute<(RowDataPacket & { failures: number })[]>(
      "SELECT failures FROM role_reauthentication WHERE user_id=? FOR UPDATE",
      [actor.id],
    );
    if (Number(attempts[0]?.failures) >= 5) return { reason: "ROLE_RATE_LIMITED" } as const;
    if (!(await compare(password, actor.password_hash))) {
      await connection.execute(
        "UPDATE role_reauthentication SET failures=failures+1 WHERE user_id=?",
        [actor.id],
      );
      return { reason: "ROLE_REAUTH_FAILED" } as const;
    }
    await connection.execute("UPDATE role_reauthentication SET failures=0 WHERE user_id=?", [
      actor.id,
    ]);
    return { passwordHash: actor.password_hash } as const;
  });
  if (proof.reason) throw new RoleSecurityError(proof.reason);
  return proof.passwordHash;
}

export async function changeUserRole(
  sessionHash: string | null,
  actorId: string,
  input: RoleChangeInput,
  metadata: RoleRequestMetadata,
) {
  const requestId = randomUUID();
  try {
    const passwordHash = await reauthenticate(sessionHash, input.password);
    // The routine starts its own transaction and rechecks the session, actor's
    // current role and verified password hash after obtaining the shared lock.
    // The runtime DB account need not be able to UPDATE users.role directly.
    await db().query("CALL change_user_role(?,?,?,?,?,?,?,?)", [
      sessionHash,
      passwordHash,
      input.id,
      input.role,
      input.expectedRole,
      requestId,
      metadata.ip,
      metadata.userAgent,
    ]);
    return { ok: true as const, role: input.role };
  } catch (error) {
    const sqlMessage = (error as { sqlMessage?: string }).sqlMessage;
    const reason =
      error instanceof RoleSecurityError
        ? error.reason
        : sqlMessage && Object.hasOwn(messages, sqlMessage)
          ? sqlMessage
          : "ROLE_DATABASE_FAILURE";
    // Rejected authenticated attempts are append-only too, outside the rolled
    // back change transaction. Log only a fixed reason code, never SQL/passwords.
    try {
      await db().execute(
        "INSERT INTO security_audit (id,actor_user_id,target_user_id,previous_role,new_role,action_type,request_id,result,reason_code,ip_address,user_agent) VALUES (?,?,?,NULL,?,?,?,'failure',?,?,?)",
        [
          randomUUID(),
          actorId,
          input.id,
          input.role,
          input.role === "admin" ? "ROLE_PROMOTED" : "ROLE_DEMOTED",
          requestId,
          reason,
          metadata.ip,
          metadata.userAgent,
        ],
      );
    } catch {
      console.error("Role-change failure audit unavailable", { requestId });
    }
    throw new RoleSecurityError(reason);
  }
}
