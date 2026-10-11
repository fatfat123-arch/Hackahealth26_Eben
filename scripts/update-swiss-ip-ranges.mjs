import { mkdir, writeFile } from "node:fs/promises";

const source = "https://ftp.ripe.net/ripe/stats/delegated-ripencc-latest";
const response = await fetch(source);
if (!response.ok) throw new Error(`RIPE NCC download failed (${response.status})`);

const ranges = (await response.text())
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split("|"))
  .filter(
    (parts) =>
      parts[1] === "CH" &&
      (parts[2] === "ipv4" || parts[2] === "ipv6") &&
      (parts[6] === "allocated" || parts[6] === "assigned"),
  )
  .map((parts) => ({ family: parts[2], start: parts[3], value: Number(parts[4]) }));

if (ranges.length < 100)
  throw new Error(`Unexpected RIPE NCC result (${ranges.length} Swiss ranges)`);
await mkdir(new URL("../config/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../config/swiss-ip-ranges.json", import.meta.url),
  `${JSON.stringify(ranges)}\n`,
);
console.log(`Saved ${ranges.length} Swiss IP ranges from RIPE NCC.`);
