import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function requireStaff(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Response("Non autorisé", { status: 401 });
  const token = header.slice(7).trim();
  if (!token) throw new Response("Non autorisé", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) throw new Response("Non autorisé", { status: 401 });

  const [{ data: role }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", auth.user.id).maybeSingle(),
    supabaseAdmin.from("profiles").select("archived_at").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (!role || profile?.archived_at) throw new Response("Accès refusé", { status: 403 });
}

function runCartooniser(input: string, runsDir: string) {
  const python = process.env["CARTOONISER_PYTHON"] || "python3";
  const script = resolve(process.cwd(), "Cartooniser/cartoonise.py");
  const timeoutMs = positiveInteger(process.env["CARTOONISER_TIMEOUT_MS"], DEFAULT_TIMEOUT_MS);

  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      python,
      [script, input, "--runs-dir", runsDir, "--max-fps", "15", "--crf", "26"],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8_000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Le traitement de la vidéo a dépassé le délai autorisé."));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(stderr.trim() || `Cartooniser arrêté (${signal || code}).`));
    });
  });
}

export async function cartooniseRequest(request: Request) {
  await requireStaff(request);
  const contentLength = Number(request.headers.get("content-length") || 0);
  const maxBytes = positiveInteger(process.env["CARTOONISER_MAX_BYTES"], DEFAULT_MAX_BYTES);
  if (contentLength > maxBytes) return new Response("Vidéo trop volumineuse", { status: 413 });

  const form = await request.formData();
  const value = form.get("video");
  if (!(value instanceof File) || !value.type.startsWith("video/")) {
    return new Response("Une vidéo est requise", { status: 400 });
  }
  if (value.size === 0 || value.size > maxBytes) {
    return new Response("Vidéo vide ou trop volumineuse", { status: 413 });
  }

  const workDir = await mkdtemp(join(tmpdir(), "eh-cartoonise-"));
  try {
    const suffix =
      extname(value.name)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, "") || ".video";
    const input = join(workDir, `input${suffix}`);
    const runs = join(workDir, "runs");
    await writeFile(input, new Uint8Array(await value.arrayBuffer()));
    await runCartooniser(input, runs);
    const output = await readFile(join(runs, "run1", "output.mp4"));
    return new Response(new Uint8Array(output), {
      headers: {
        "content-type": "video/mp4",
        "content-disposition": 'attachment; filename="cartoon-video.mp4"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Cartooniser failed", error);
    return new Response("La transformation en dessin animé a échoué.", { status: 500 });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
