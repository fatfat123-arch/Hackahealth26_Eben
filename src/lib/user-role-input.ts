import { z } from "zod";

export const userRole = z.enum(["admin", "caregiver"]);
export type UserRole = z.infer<typeof userRole>;
export const roleChangeSchema = z
  .object({
    id: z.string().uuid(),
    role: userRole,
    expectedRole: userRole,
    password: z.string().min(1).max(128),
  })
  .strict();
export type RoleChangeInput = z.infer<typeof roleChangeSchema>;

export function parseRoleChangeInput(input: unknown): RoleChangeInput {
  const result = roleChangeSchema.safeParse(input);
  if (!result.success) throw new Error("Les données du changement de rôle sont invalides.");
  return result.data;
}

export const createCaregiverSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
  })
  .strict();
export const updateCaregiverSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
  })
  .strict();
