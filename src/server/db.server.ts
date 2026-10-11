import mysql from "mysql2/promise";

let pool: mysql.Pool | undefined;

export function db() {
  if (!pool) {
    const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) throw new Error(`Missing database settings: ${missing.join(", ")}`);
    pool = mysql.createPool({
      host: process.env["DB_HOST"]!,
      port: Number(process.env["DB_PORT"] || 3306),
      database: process.env["DB_NAME"]!,
      user: process.env["DB_USER"]!,
      password: process.env["DB_PASSWORD"]!,
      charset: "utf8mb4",
      connectionLimit: 8,
      enableKeepAlive: true,
    });
  }
  return pool;
}

export type DbUser = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: "admin" | "caregiver";
  archived_at: Date | null;
  created_at: Date;
};

export function iso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

/** Preserve a MariaDB DATE as YYYY-MM-DD without locale or timezone conversion. */
export function dateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

export function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}
