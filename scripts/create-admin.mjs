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
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
await connection.execute(
  "INSERT INTO users (id,email,full_name,password_hash,role) VALUES (?,?,?,?, 'admin') ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash), role='admin', archived_at=NULL",
  [randomUUID(), email, name, await hash(password, 12)],
);
await connection.end();
console.log("Admin account ready.");
