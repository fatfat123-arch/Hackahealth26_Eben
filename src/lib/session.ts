import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET } from "@/lib/patients";

export type Me = { id: string; email: string; name: string; isAdmin: boolean; isStaff: boolean };

export async function fetchMe(): Promise<Me | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const list = (roles ?? []).map(r => r.role);
  return { id: user.id, email: user.email ?? "", name: profile?.full_name ?? "", isAdmin: list.includes("admin"), isStaff: list.length > 0 };
}

export const meQuery = queryOptions({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });

export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(unique, 60 * 60 * 6);
  const out: Record<string, string> = {};
  for (const s of data ?? []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
  return out;
}
