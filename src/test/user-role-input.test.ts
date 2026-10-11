import { describe, expect, it } from "vitest";
import {
  createCaregiverSchema,
  updateCaregiverSchema,
  parseRoleChangeInput,
  roleChangeSchema,
} from "@/lib/user-role-input";

const id = "00000000-0000-4000-8000-000000000001";
describe("Role-management inputs", () => {
  it("accepts only the two existing roles and requires a saved-role precondition without a password", () => {
    const input = {
      id,
      role: "admin",
      expectedRole: "caregiver",
    };
    expect(parseRoleChangeInput(input)).toEqual(input);
    for (const invalid of [
      { ...input, role: "owner" },
      { ...input, id: "bad" },
      { ...input, expectedRole: undefined },
    ])
      expect(roleChangeSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects invented actor IDs, permissions, timestamps and other client authorization claims", () => {
    const input = { id, role: "admin", expectedRole: "caregiver" };
    for (const extra of [
      { actorId: id },
      { password: "test-password" },
      { isAdmin: true },
      { can_manage_roles: true },
      { timestamp: "2026-01-01" },
      { requestId: id },
    ])
      expect(() => parseRoleChangeInput({ ...input, ...extra })).toThrow("invalides");
  });
  it("prevents account creation and ordinary profile updates from assigning privileged fields", () => {
    const create = {
      name: "Compte fictif",
      email: "test@example.invalid",
      password: "test-password",
    };
    const update = { id, name: create.name, email: create.email };
    expect(createCaregiverSchema.safeParse(create).success).toBe(true);
    expect(updateCaregiverSchema.safeParse(update).success).toBe(true);
    for (const fields of [
      { role: "admin" },
      { isAdmin: true },
      { password_hash: "forged" },
      { can_manage_roles: true },
    ]) {
      expect(createCaregiverSchema.safeParse({ ...create, ...fields }).success).toBe(false);
      expect(updateCaregiverSchema.safeParse({ ...update, ...fields }).success).toBe(false);
    }
  });
});
