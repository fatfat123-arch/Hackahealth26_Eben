import { describe, expect, it } from "vitest";
import { ageFromBirthDate } from "@/lib/patients";

describe("ageFromBirthDate", () => {
  const today = new Date(2026, 9, 10);

  it("calculates the age after the birthday", () => {
    expect(ageFromBirthDate("2000-01-15", today)).toBe("26 ans");
  });

  it("does not increment the age before the birthday", () => {
    expect(ageFromBirthDate("2000-12-15", today)).toBe("25 ans");
  });

  it("returns a placeholder for a missing date", () => {
    expect(ageFromBirthDate(null, today)).toBe("—");
  });
});
