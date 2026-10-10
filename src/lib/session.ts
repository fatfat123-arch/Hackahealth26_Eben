import { queryOptions } from "@tanstack/react-query";
import { getMe } from "@/lib/auth.functions";
import { signMediaPaths } from "@/lib/patients.functions";

export type Me = { id: string; email: string; name: string; isAdmin: boolean; isStaff: boolean };

export async function fetchMe(): Promise<Me | null> {
  return getMe();
}

export const meQuery = queryOptions({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });

export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  return signMediaPaths({ data: { paths: unique } });
}
