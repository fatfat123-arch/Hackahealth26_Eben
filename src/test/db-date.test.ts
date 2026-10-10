import { describe, expect, it } from "vitest";
import { dateOnly } from "@/server/db.server";

describe("dateOnly", () => {
  it("converts a MariaDB Date object without using its locale string", () => {
    expect(dateOnly(new Date("1990-04-02T00:00:00.000Z"))).toBe("1990-04-02");
  });

  it("keeps a MariaDB date string", () => {
    expect(dateOnly("2002-07-22")).toBe("2002-07-22");
  });

  it("rejects malformed dates", () => {
    expect(dateOnly("Mon Apr 0")).toBeNull();
  });

  it("rejects an invalid Date object", () => {
    expect(dateOnly(new Date("invalid"))).toBeNull();
  });
});
