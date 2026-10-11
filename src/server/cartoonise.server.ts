import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import {
  limitedFormData,
  rejectCrossOrigin,
  RequestBodyTooLargeError,
} from "@/server/request-security.server";
import { mediaContentMatches, mediaKind } from "@/lib/media-limits";

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
let activeCartoonisers = 0;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function requireStaff(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)(?:__Host-)?eh_session=([^;]+)/)?.[1];
  const { sessionUserFromToken } = await import("@/server/auth.server");
  const user = await sessionUserFromToken(cookie ? decodeURIComponent(cookie) : null);
  if (!user || user.archived_at) throw new Response("Non autorisé", { status: 401 });
  if (user.role !== "admin")
    throw new Response("Option réservée aux administrateurs", { status: 403 });
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
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  await requireStaff(request);
  const contentLength = Number(request.headers.get("content-length") || 0);
  const maxBytes = positiveInteger(process.env["CARTOONISER_MAX_BYTES"], DEFAULT_MAX_BYTES);
  if (contentLength > maxBytes) return new Response("Vidéo trop volumineuse", { status: 413 });

  let form: FormData;
  try {
    form = await limitedFormData(request, maxBytes);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError)
      return new Response("Vidéo trop volumineuse", { status: 413 });
    throw error;
  }
  const value = form.get("video");
  if (!(value instanceof File) || mediaKind(value.type) !== "video") {
    return new Response("Une vidéo est requise", { status: 400 });
  }
  if (value.size === 0 || value.size > maxBytes) {
    return new Response("Vidéo vide ou trop volumineuse", { status: 413 });
  }
  if (!(await mediaContentMatches(value)))
    return new Response("Le contenu de la vidéo ne correspond pas à son format.", { status: 415 });

  const maxConcurrent = positiveInteger(process.env["CARTOONISER_MAX_CONCURRENT"], 1);
  if (activeCartoonisers >= maxConcurrent) {
    return new Response("Le traitement vidéo est occupé. Réessayez dans quelques instants.", {
      status: 429,
      headers: { "retry-after": "30" },
    });
  }

  activeCartoonisers += 1;
  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "eh-cartoonise-"));
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
    if (workDir) await rm(workDir, { recursive: true, force: true });
    activeCartoonisers -= 1;
  }
}
