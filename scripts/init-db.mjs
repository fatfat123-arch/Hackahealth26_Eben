import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});
await connection.query(await readFile(new URL("../database/schema.sql", import.meta.url), "utf8"));
const [ageColumns] = await connection.query(
  "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='patients' AND COLUMN_NAME='age' LIMIT 1",
  [process.env.DB_NAME],
);
if (ageColumns.length === 0) {
  await connection.query("ALTER TABLE patients ADD COLUMN age TINYINT UNSIGNED NULL AFTER name");
  await connection.query("UPDATE patients SET age=TIMESTAMPDIFF(YEAR,birth_date,CURDATE()) WHERE birth_date IS NOT NULL");
}
await connection.end();
console.log("MariaDB schema ready.");
