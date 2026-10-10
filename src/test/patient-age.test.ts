import { describe, expect, it } from "vitest";
import { ageFromBirthDate, patientValidationError } from "@/lib/patients";

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

describe("patientValidationError", () => {
  it("rejects a future birth date before saving", () => {
    expect(patientValidationError({ name: "Lina", birthDate: "2027-01-01", phone: "" }, new Date(2026, 9, 10))).toContain("futur");
  });

  it("rejects letters in a phone number", () => {
    expect(patientValidationError({ name: "Lina", birthDate: "2000-01-01", phone: "+41 ABC 123" })).toContain("lettres");
  });

  it("accepts common Swiss phone formatting", () => {
    expect(patientValidationError({ name: "Lina", birthDate: "2000-01-01", phone: "+41 (0)79 123 45 67" })).toBeNull();
  });
});
