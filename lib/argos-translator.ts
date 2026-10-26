import { spawn } from "node:child_process";
import path from "node:path";

export type TranslationInput = {
  title: string;
  excerpt: string;
  content: string;
};

export type TranslationOutput = TranslationInput;

export function translateSqToEn(items: TranslationInput[]): Promise<TranslationOutput[]> {
  const python = process.env.ARGOS_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = path.join(process.cwd(), "scripts", "translate-sq-en.py");

  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(new Error("Argos Translate exceeded the 90-second batch limit."));
      }
    }, 90_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(new Error(`Could not start local Argos Translate (${python}): ${error.message}`));
      }
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Argos Translate exited with status ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as TranslationOutput[]);
      } catch {
        reject(new Error("Argos Translate returned an invalid response."));
      }
    });

    child.stdin.end(JSON.stringify(items));
  });
}
