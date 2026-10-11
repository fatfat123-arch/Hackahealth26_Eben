// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { hash } from "bcryptjs";
import mysql, { type Connection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeUserRole,
  guardAccountRemoval,
  withAccountTransaction,
} from "@/server/user-roles.server";
import { db } from "@/server/db.server";
import { sessionUserFromToken, publicUser } from "@/server/auth.server";

// Destructive fixture resets are confined to this explicit LOCAL test database.
const enabled = process.env["ROLE_TEST_DB"] === "1";
const database = "eh_roles_test";
const port = Number(process.env["ROLE_TEST_DB_PORT"] ?? 33307);
const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const C = "00000000-0000-4000-8000-000000000003";
const password = "fictitious-test-password";
const tokens: Record<string, string> = {
  [A]: "fictitious-session-A",
  [B]: "fictitious-session-B",
  [C]: "fictitious-session-C",
};
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const tokenHash = (id: string) => digest(tokens[id]!);
const metadata = { ip: "127.0.0.1", userAgent: "Security integration test" };
const promote = (target: string) => ({
  id: target,
  role: "admin" as const,
  expectedRole: "caregiver" as const,
  password,
});
const demote = (target: string) => ({
  id: target,
  role: "caregiver" as const,
  expectedRole: "admin" as const,
  password,
});
let root: Connection;
let passwordHash: string;
let runtimeReady = false;
async function rows(sql: string, parameters: (string | number | null)[] = []) {
  const [result] = await root.execute<RowDataPacket[]>(sql, parameters);
  return result;
}
describe.skipIf(!enabled)("MariaDB role security with restricted runtime grants", () => {
  beforeAll(async () => {
    if (port === 3306 || !Number.isInteger(port))
      throw new Error("Use an isolated local test server, not port 3306.");
    root = await mysql.createConnection({
      host: "127.0.0.1",
      port,
      user: "root",
      password: process.env["ROLE_TEST_DB_ROOT_PASSWORD"] ?? "",
      multipleStatements: true,
    });
    await root.query(`CREATE DATABASE IF NOT EXISTS ${database}; USE ${database}`);
    await root.query(readFileSync("database/schema.sql", "utf8"));
    await root.query(readFileSync("database/role-management.sql", "utf8"));
    await root.query(
      "CREATE USER IF NOT EXISTS 'eh_role_test_runtime'@'localhost' IDENTIFIED BY 'fictitious-db-test-password'",
    );
    await root.query(`
      GRANT SELECT ON ${database}.users TO 'eh_role_test_runtime'@'localhost';
      GRANT INSERT (id,email,full_name,password_hash), UPDATE (full_name,email,password_hash,archived_at), DELETE ON ${database}.users TO 'eh_role_test_runtime'@'localhost';
      GRANT SELECT,INSERT,DELETE ON ${database}.sessions TO 'eh_role_test_runtime'@'localhost';
      GRANT SELECT,INSERT,UPDATE,DELETE ON ${database}.patients TO 'eh_role_test_runtime'@'localhost';
      GRANT SELECT,UPDATE ON ${database}.account_security_lock TO 'eh_role_test_runtime'@'localhost';
      GRANT SELECT,INSERT,UPDATE ON ${database}.role_reauthentication TO 'eh_role_test_runtime'@'localhost';
      GRANT INSERT ON ${database}.security_audit TO 'eh_role_test_runtime'@'localhost';
      GRANT EXECUTE ON PROCEDURE ${database}.change_user_role TO 'eh_role_test_runtime'@'localhost';
    `);
    // Verify repeated deployment migrations retain the procedure's grants.
    await root.query(readFileSync("database/role-management.sql", "utf8"));
    Object.assign(process.env, {
      DB_HOST: "127.0.0.1",
      DB_PORT: String(port),
      DB_NAME: database,
      DB_USER: "eh_role_test_runtime",
      DB_PASSWORD: "fictitious-db-test-password",
    });
    runtimeReady = true;
    passwordHash = await hash(password, 4);
  });
  beforeEach(async () => {
    await root.query("DROP TRIGGER IF EXISTS test_audit_failure");
    await root.query(
      "SET FOREIGN_KEY_CHECKS=0; TRUNCATE patients; TRUNCATE sessions; TRUNCATE users; TRUNCATE role_reauthentication; TRUNCATE security_audit; SET FOREIGN_KEY_CHECKS=1",
    );
    for (const [id, role] of [
      [A, "admin"],
      [B, "admin"],
      [C, "caregiver"],
    ] as const) {
      await root.execute(
        "INSERT INTO users(id,email,full_name,password_hash,role) VALUES (?,?,?,?,?)",
        [id, `${id}@example.invalid`, `Fictitious ${id.slice(-1)}`, passwordHash, role],
      );
      await root.execute(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [tokenHash(id!), id],
      );
    }
  });
  afterAll(async () => {
    if (!root) return;
    if (runtimeReady) await db().end();
    await root.end();
  });

  it("promotes atomically, derives the audit actor from the session, and preserves account/assignment data", async () => {
    await root.query(`INSERT INTO patients(id,public_id,name,address,about,how_to,reminder,dictionary,communicates,understanding_needs,tools,facilitators,interests,dislikes,additional,section_order,created_by)
      VALUES ('test-patient','test-public','FICTIONAL_PATIENT','address','about','how','reminder','[]','[]','[]','[]','[]','[]','[]','[]','[]','${C}')`);
    const before = await rows("SELECT email,full_name,password_hash FROM users WHERE id=?", [C]);
    const result = await changeUserRole(tokenHash(A), A, promote(C), metadata);
    expect(result.role).toBe("admin");
    expect(await rows("SELECT email,full_name,password_hash FROM users WHERE id=?", [C])).toEqual(
      before,
    );
    expect((await rows("SELECT created_by,about FROM patients"))[0]).toMatchObject({
      created_by: C,
      about: "about",
    });
    const audits = await rows("SELECT * FROM security_audit");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actor_user_id: A,
      target_user_id: C,
      previous_role: "caregiver",
      new_role: "admin",
      action_type: "ROLE_PROMOTED",
      result: "success",
      ip_address: "127.0.0.1",
    });
    expect(audits[0]!["occurred_at"]).toBeInstanceOf(Date);
    expect(audits[0]!["request_id"]).toMatch(/^[\da-f-]{36}$/);
    const serialized = JSON.stringify(audits);
    for (const forbidden of [password, passwordHash, tokens[A], tokenHash(A), "FICTIONAL_PATIENT"])
      expect(serialized).not.toContain(forbidden);
  });
  it("demotes and immediately revokes every existing target session; new sessions read the current role", async () => {
    await root.execute(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))",
      [digest("second-B-session"), B],
    );
    await changeUserRole(tokenHash(A), A, demote(B), metadata);
    expect(await sessionUserFromToken(tokens[B])).toBeNull();
    expect(await rows("SELECT * FROM sessions WHERE user_id=?", [B])).toHaveLength(0);
    await expect(changeUserRole(tokenHash(B), B, promote(C), metadata)).rejects.toThrow(
      "Accès réservé",
    );
    await root.execute(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))",
      [tokenHash(B), B],
    );
    expect(publicUser((await sessionUserFromToken(tokens[B]))!).isAdmin).toBe(false);
    await expect(changeUserRole(tokenHash(B), B, promote(C), metadata)).rejects.toThrow(
      "Accès réservé",
    );
  });
  it.each([C, A])("rejects a caregiver changing %s, including self-promotion", async (target) => {
    await expect(changeUserRole(tokenHash(C), C, promote(target), metadata)).rejects.toThrow(
      "Accès réservé",
    );
    expect((await rows("SELECT role FROM users WHERE id=?", [C]))[0]!["role"]).toBe("caregiver");
    expect(await rows("SELECT * FROM security_audit WHERE result='success'")).toHaveLength(0);
  });
  it("rejects anonymous, expired, archived and revoked actors", async () => {
    await expect(changeUserRole(null, A, promote(C), metadata)).rejects.toThrow("Accès réservé");
    await root.execute(
      "UPDATE sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE user_id=?",
      [A],
    );
    await expect(changeUserRole(tokenHash(A), A, promote(C), metadata)).rejects.toThrow(
      "Accès réservé",
    );
    await root.execute("UPDATE users SET archived_at=NOW() WHERE id=?", [B]);
    await expect(changeUserRole(tokenHash(B), B, promote(C), metadata)).rejects.toThrow(
      "Accès réservé",
    );
  });
  it("prevents all self role changes and removal of the final administrator", async () => {
    await expect(changeUserRole(tokenHash(A), A, demote(A), metadata)).rejects.toThrow(
      "propre rôle",
    );
    await root.execute("UPDATE users SET role='caregiver' WHERE id=?", [B]);
    await expect(
      withAccountTransaction(tokenHash(A), (connection, actor) =>
        guardAccountRemoval(connection, actor, A, true),
      ),
    ).rejects.toThrow("propre compte");
    expect(
      (
        await rows("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND archived_at IS NULL")
      )[0]!["n"],
    ).toBe(1);
  });
  it("serializes duplicate promotions with exactly one successful audit record", async () => {
    const attempts = await Promise.allSettled([
      changeUserRole(tokenHash(A), A, promote(C), metadata),
      changeUserRole(tokenHash(A), A, promote(C), metadata),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await rows("SELECT * FROM security_audit WHERE result='success'")).toHaveLength(1);
    expect(await rows("SELECT * FROM security_audit WHERE result='failure'")).toHaveLength(1);
  });
  it("concurrent cross-demotions cannot remove both remaining administrators", async () => {
    const attempts = await Promise.allSettled([
      changeUserRole(tokenHash(A), A, demote(B), metadata),
      changeUserRole(tokenHash(B), B, demote(A), metadata),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await rows("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND archived_at IS NULL")
      )[0]!["n"],
    ).toBe(1);
    expect(await rows("SELECT * FROM security_audit WHERE result='success'")).toHaveLength(1);
  });
  it.each(["archive", "delete"])(
    "serializes %s versus demotion, preserving one active administrator",
    async (action) => {
      const removal = () =>
        withAccountTransaction(tokenHash(B), async (connection, actor) => {
          await guardAccountRemoval(connection, actor, A, true);
          await connection.execute(
            action === "archive"
              ? "UPDATE users SET archived_at=NOW() WHERE id=?"
              : "DELETE FROM users WHERE id=?",
            [A],
          );
          await connection.execute("DELETE FROM sessions WHERE user_id=?", [A]);
        });
      const attempts = await Promise.allSettled([
        changeUserRole(tokenHash(A), A, demote(B), metadata),
        removal(),
      ]);
      expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        (
          await rows("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND archived_at IS NULL")
        )[0]!["n"],
      ).toBe(1);
    },
  );
  it("rolls back role and session changes if the success audit cannot be inserted", async () => {
    await root.query(
      "CREATE TRIGGER test_audit_failure BEFORE INSERT ON security_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_AUDIT_UNAVAILABLE'",
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(changeUserRole(tokenHash(A), A, promote(C), metadata)).rejects.toThrow(
        "n’a pas pu être confirmé",
      );
      expect((await rows("SELECT role FROM users WHERE id=?", [C]))[0]!["role"]).toBe("caregiver");
      expect(await sessionUserFromToken(tokens[C])).not.toBeNull();
      expect(await rows("SELECT * FROM security_audit")).toHaveLength(0);
    } finally {
      log.mockRestore();
      await root.query("DROP TRIGGER test_audit_failure");
    }
  });
  it("durably rate-limits wrong password attempts across requests, then allows a fresh window", async () => {
    for (let index = 0; index < 5; index++)
      await expect(
        changeUserRole(
          tokenHash(A),
          A,
          { ...promote(C), password: "incorrect-password" },
          metadata,
        ),
      ).rejects.toThrow("incorrect");
    await expect(changeUserRole(tokenHash(A), A, promote(C), metadata)).rejects.toThrow(
      "quinze minutes",
    );
    expect(
      (await rows("SELECT failures FROM role_reauthentication WHERE user_id=?", [A]))[0]![
        "failures"
      ],
    ).toBe(5);
    await root.execute(
      "UPDATE role_reauthentication SET window_start=DATE_SUB(NOW(),INTERVAL 16 MINUTE) WHERE user_id=?",
      [A],
    );
    await expect(changeUserRole(tokenHash(A), A, promote(C), metadata)).resolves.toMatchObject({
      role: "admin",
    });
  });
  it("denies direct privileged updates and prevents runtime edits, deletions and truncation of the audit", async () => {
    await changeUserRole(tokenHash(A), A, promote(C), metadata);
    await expect(
      db().execute("UPDATE users SET role='caregiver' WHERE id=?", [C]),
    ).rejects.toThrow();
    await expect(
      db().execute("INSERT INTO users(id,email,full_name,password_hash,role) VALUES (?,?,?,?,?)", [
        "forged",
        "forged@example.invalid",
        "Forged",
        passwordHash,
        "admin",
      ]),
    ).rejects.toThrow();
    for (const statement of [
      "UPDATE security_audit SET result='failure'",
      "DELETE FROM security_audit",
      "TRUNCATE security_audit",
      "DROP TABLE security_audit",
    ])
      await expect(db().query(statement)).rejects.toThrow();
    await expect(root.query("UPDATE security_audit SET result='failure'")).rejects.toThrow(
      "AUDIT_IMMUTABLE",
    );
    await expect(root.query("DELETE FROM security_audit")).rejects.toThrow("AUDIT_IMMUTABLE");
    await root.execute("DELETE FROM users WHERE id=?", [C]);
    expect(await rows("SELECT * FROM security_audit")).toHaveLength(1);
  });
  it("rechecks password proof and allowed roles inside the stored operation", async () => {
    const call = (proof: string, role: string, previous = "caregiver") =>
      db().query("CALL change_user_role(?,?,?,?,?,?,?,?)", [
        tokenHash(A),
        proof,
        C,
        role,
        previous,
        A,
        null,
        null,
      ]);
    await expect(call("forged-password-hash", "admin")).rejects.toThrow("ROLE_REAUTH_REQUIRED");
    await expect(call(passwordHash, "owner")).rejects.toThrow("ROLE_INVALID");
    await expect(call(passwordHash, "caregiver")).rejects.toThrow("ROLE_INVALID");
    await root.execute("UPDATE users SET password_hash=? WHERE id=?", [
      await hash("new-password", 4),
      A,
    ]);
    await expect(call(passwordHash, "admin")).rejects.toThrow("ROLE_REAUTH_REQUIRED");
    expect((await rows("SELECT role FROM users WHERE id=?", [C]))[0]!["role"]).toBe("caregiver");
  });
});
