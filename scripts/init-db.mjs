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
  await connection.query(
    "UPDATE patients SET age=TIMESTAMPDIFF(YEAR,birth_date,CURDATE()) WHERE birth_date IS NOT NULL",
  );
}
const [publicIdColumns] = await connection.query(
  "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='patients' AND COLUMN_NAME='public_id' LIMIT 1",
  [process.env.DB_NAME],
);
if (publicIdColumns.length === 0) {
  await connection.query("ALTER TABLE patients ADD COLUMN public_id VARCHAR(64) NULL AFTER id");
  await connection.query(
    "UPDATE patients SET public_id=id WHERE public_id IS NULL OR public_id=''",
  );
  await connection.query("ALTER TABLE patients MODIFY public_id VARCHAR(64) NOT NULL");
  await connection.query(
    "ALTER TABLE patients ADD UNIQUE KEY patients_public_id_unique (public_id)",
  );
}
const [photoPositionColumns] = await connection.query(
  "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='patients' AND COLUMN_NAME='photo_position_y' LIMIT 1",
  [process.env.DB_NAME],
);
if (photoPositionColumns.length === 0) {
  await connection.query(
    "ALTER TABLE patients ADD COLUMN photo_position_y TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER photo_alt",
  );
}
await connection.end();
console.log("MariaDB schema ready.");
