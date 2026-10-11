import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import mysql from "mysql2/promise";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
const email = (await rl.question("Admin email: ")).trim().toLowerCase();
const name = (await rl.question("Admin name: ")).trim();
const hiddenQuestion = async (prompt) => {
  process.stdout.write(prompt);
  muted = true;
  const value = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  return value;
};
const password = await hiddenQuestion("Temporary password (hidden, 8+ characters): ");
const confirmation = await hiddenQuestion("Confirm password: ");
rl.close();
if (password !== confirmation) throw new Error("Passwords do not match.");
if (!email || !name || password.length < 8)
  throw new Error("Email, name and an 8-character password are required.");
if (process.env.DB_MIGRATION_USER && !process.env.DB_MIGRATION_PASSWORD)
  throw new Error("DB_MIGRATION_PASSWORD is required with DB_MIGRATION_USER.");
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_MIGRATION_USER || process.env.DB_USER,
  password: process.env.DB_MIGRATION_USER
    ? process.env.DB_MIGRATION_PASSWORD
    : process.env.DB_PASSWORD,
});
try {
  await connection.beginTransaction();
  const [lock] = await connection.query(
    "SELECT id FROM account_security_lock WHERE id=1 FOR UPDATE",
  );
  if (!lock.length)
    throw new Error(
      "Le verrou de sécurité est absent. Exécutez db:init avant de créer le premier administrateur.",
    );
  const [admins] = await connection.query(
    "SELECT id FROM users WHERE role='admin' AND archived_at IS NULL LIMIT 1 FOR UPDATE",
  );
  if (admins.length)
    throw new Error(
      "Un administrateur existe déjà. Utilisez la gestion des rôles de l’application pour créer d’autres administrateurs.",
    );
  await connection.execute(
    "INSERT INTO users (id,email,full_name,password_hash,role) VALUES (?,?,?,?, 'admin')",
    [randomUUID(), email, name, await hash(password, 12)],
  );
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
console.log("Admin account ready.");
