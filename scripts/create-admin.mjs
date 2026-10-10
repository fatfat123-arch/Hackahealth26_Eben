import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import mysql from "mysql2/promise";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (await rl.question("Admin email: ")).trim().toLowerCase();
const name = (await rl.question("Admin name: ")).trim();
const password = await rl.question("Temporary password (8+ characters): ");
rl.close();
if (!email || !name || password.length < 8) throw new Error("Email, name and an 8-character password are required.");
const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
await connection.execute("INSERT INTO users (id,email,full_name,password_hash,role) VALUES (?,?,?,?, 'admin') ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash), role='admin', archived_at=NULL", [randomUUID(), email, name, await hash(password, 12)]);
await connection.end();
console.log("Admin account ready.");
