import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { log } from "./logger.js";

const execFileAsync = promisify(execFile);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function triggerCapture(countdownMs: number): Promise<void> {
  log.info(`Remote capture requested. Shooting in ${Math.round(countdownMs / 1000)} seconds...`);
  await sleep(countdownMs);

  if (process.platform !== "win32") {
    throw new Error("Automatic Imaging Edge trigger is currently supported on Windows only");
  }

  // Sony Imaging Edge Remote's official keyboard shortcut for Photo is "1".
  const key = process.env.FWF_CAPTURE_KEY ?? "1";
  const escapedKey = key.replace(/'/g, "''");
  const script = [
    "$shell = New-Object -ComObject WScript.Shell",
    `$shell.SendKeys('${escapedKey}')`,
  ].join("; ");

  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    windowsHide: true,
  });
  log.success("Capture key sent to the active Windows application.");
}
